import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const SUMMARIZE_EVERY_N_MESSAGES = 4;

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Given a conversation between a user and an AI assistant about their ClickUp workspace, produce a JSON response with two fields.

Return ONLY valid JSON matching this format:
{
  "summary": "5-8 sentence summary capturing main topics, decisions, actions taken, pending questions, AND any workspace structure that was proposed or agreed upon",
  "facts": ["fact 1", "fact 2"]
}

Summary rules:
- CRITICAL: The previous summary contains context from earlier in the conversation. You MUST preserve all key decisions, instructions, and preferences from the previous summary. Only drop greetings or redundant pleasantries.
- Be factual and specific. Include names, numbers, and key details.
- Always preserve: user decisions, explicit instructions/rules the user stated, workspace structure preferences, and any action items that are still pending.
- WORKSPACE STRUCTURE PRESERVATION: If the assistant proposed a workspace structure (spaces, folders, lists, statuses), you MUST include the structure details in the summary. List the space names, list names, and any agreed-upon statuses. This is critical context that must survive across message windows.
- When incorporating new messages, ADD to the previous summary rather than replacing it. The summary should grow in detail (up to the token limit), not lose earlier context.
- If the user approved or confirmed a structure, note that it was approved and include its details.

Facts rules:
- Extract user preferences, decisions, and important context that should be remembered across conversations.
- PRIORITY FACTS (always extract these if mentioned, even if previously captured):
  * Business type / industry (e.g., "User runs an operations consulting firm")
  * Team size (e.g., "Team has 2-5 people")
  * Services or products they offer
  * Work style (client-based, product-based, project-based)
  * Key business decisions about workspace structure
  * Approved workspace structure names (e.g., "Approved structure: Client Engagements, Business Operations, Growth spaces")
- ALSO EXTRACT these as facts:
  * Any explicit instruction or rule the user stated (e.g., "I want only 2 spaces", "No folders, keep it flat")
  * Workflow descriptions (e.g., "Our process is: backlog, in progress, review, done")
  * Preferences about tags, statuses, or custom fields
  * What the user wants to keep or remove from their existing workspace
  * Specific structure modifications requested (e.g., "rename space 3 to Operations", "delete list 4")
- Only include facts explicitly stated by the user, not inferred.
- If no new facts are found, return an empty array.
- Keep each fact to one concise sentence.

Previous summary (if any): {previous_summary}

Recent messages to incorporate:
{messages}`;

/**
 * Check if summarization is needed and run it if so.
 *
 * Called AFTER every message is saved. Runs asynchronously —
 * does not block the user's response.
 *
 * Logic:
 * 1. Increment message_count on the conversation
 * 2. If message_count % 4 === 0, trigger summarization
 * 3. Load last 4 messages + existing summary
 * 4. Call Haiku to generate updated summary
 * 5. Store new summary in conversations.summary
 */
export async function maybeSummarizeConversation(
  conversationId: string,
  _workspaceId: string,
): Promise<void> {
  const supabase = getAdminClient();

  try {
    // Increment message count and get current value
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('message_count, summary')
      .eq('id', conversationId)
      .single();

    if (fetchError || !conversation) return;

    const newCount = (conversation.message_count || 0) + 1;

    // Update count
    await supabase
      .from('conversations')
      .update({ message_count: newCount })
      .eq('id', conversationId);

    // Check if we should summarize (every 4 messages)
    if (newCount % SUMMARIZE_EVERY_N_MESSAGES !== 0) return;

    // Load last 8 messages (4 user + 4 assistant) for context
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (!messages || messages.length < 4) return;

    // Format messages for the summarizer
    const formattedMessages = messages
      .reverse()
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${(m.content as string).slice(0, 500)}`)
      .join('\n\n');

    const prompt = SUMMARIZATION_PROMPT
      .replace('{previous_summary}', (conversation.summary as string) || 'None — this is the first summary.')
      .replace('{messages}', formattedMessages);

    // Call Haiku
    const client = getClient();
    const response = await client.messages.create({
      model: HAIKU_MODEL_ID,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Parse JSON response; fall back to raw text as summary if JSON parse fails
    let summary = rawText;
    let facts: string[] = [];

    try {
      // Strip markdown fences if present
      let jsonStr = rawText;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.facts)) facts = parsed.facts.filter((f: unknown) => typeof f === 'string' && f.length > 0);
    } catch {
      // Haiku returned plain text instead of JSON — use as summary, no facts
    }

    if (summary) {
      await supabase
        .from('conversations')
        .update({ summary })
        .eq('id', conversationId);
    }

    // Save extracted facts to user_memories (if any)
    if (facts.length > 0) {
      // Look up workspace to get user_id for the memory
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_id, workspace_id')
        .eq('id', conversationId)
        .single();

      if (conv?.user_id) {
        const memoryRows = facts.map(fact => ({
          user_id: conv.user_id,
          workspace_id: conv.workspace_id,
          category: 'auto_extracted',
          content: fact,
          source_conversation_id: conversationId,
        }));

        const { error: memErr } = await supabase
          .from('user_memories')
          .insert(memoryRows);

        if (memErr) {
          // Table may not exist yet — log and continue
          console.error('[conversation-summary] Failed to save facts:', memErr.message);
        }
      }
    }
  } catch (error) {
    // Summarization is non-critical — log and continue
    console.error('[conversation-summary] Failed:', error);
  }
}
