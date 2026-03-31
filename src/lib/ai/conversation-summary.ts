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

const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Given a conversation between a user and an AI assistant about their ClickUp workspace, produce a concise 2-3 sentence summary that captures:
1. The main topics discussed
2. Any decisions made or actions taken
3. Any pending questions or next steps

Be factual and specific. Include names, numbers, and key details. Do not include greetings or pleasantries.

Previous summary (if any): {previous_summary}

Recent messages to incorporate:
{messages}

Write your updated summary:`;

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
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (summary) {
      await supabase
        .from('conversations')
        .update({ summary })
        .eq('id', conversationId);
    }
  } catch (error) {
    // Summarization is non-critical — log and continue
    console.error('[conversation-summary] Failed:', error);
  }
}
