import { NextRequest, NextResponse } from 'next/server';
import { handleSetupMessage } from '@/lib/setup/setupper-brain';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { maybeSummarizeConversation } from '@/lib/ai/conversation-summary';

// ---------------------------------------------------------------------------
// Token budget for conversation history.
// Setup is always premium (2.0 credits = $0.24 revenue). At 30K history
// tokens the Anthropic cost is ~$0.105 per message, keeping margin above 50%.
// Typical setup conversations (10-30 messages) use ~6K-20K tokens and never
// hit this limit, so they always get full history with zero summarization.
// ---------------------------------------------------------------------------
const HISTORY_TOKEN_BUDGET = 30_000;

/** Rough token estimate: ~4 chars per token (conservative for English text). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup:${authUser.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await request.json();
    const { workspace_id, conversation_id, message, workspace_analysis, proposed_plan, profile_data, file_context, chat_structure_snapshot } = body;

    if (!workspace_id || !conversation_id || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // -----------------------------------------------------------------------
    // PHASE 1: Persist user message FIRST, then load context in parallel.
    // This ensures conversation history is always complete even if the AI
    // call times out or fails — the next retry will see all prior messages.
    // -----------------------------------------------------------------------

    // Ensure conversation record exists (must happen before message insert)
    await adminClient
      .from('conversations')
      .upsert(
        {
          id: conversation_id,
          workspace_id,
          user_id: authUser.id,
          context_type: 'setup',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    // Save user message to DB immediately — before the AI call
    await adminClient.from('messages').insert({
      workspace_id,
      conversation_id,
      role: 'user',
      content: message.trim(),
      credits_used: 0,
    });

    // Load context in parallel
    const [workspaceResult, historyResult, conversationResult] = await Promise.all([
      adminClient
        .from('workspaces')
        .select('clickup_plan_tier')
        .eq('id', workspace_id)
        .single(),
      // Load full conversation history (up to 200 messages safety cap).
      // We send as many messages as fit within the HISTORY_TOKEN_BUDGET so
      // the AI always has maximum context. Summarization only kicks in for
      // very long conversations that exceed the budget.
      adminClient
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(200),
      // Conversation summary (used only when history exceeds token budget)
      adminClient
        .from('conversations')
        .select('summary')
        .eq('id', conversation_id)
        .single(),
    ]);

    const planTier = workspaceResult.data?.clickup_plan_tier || 'free';

    // Build conversation history with token-budget approach:
    // - Send full history when it fits within the budget (most conversations)
    // - When history exceeds the budget, keep as many recent messages as fit
    //   and prepend the summary for older context (same as Claude/ChatGPT but
    //   with a lower ceiling since we pay per token)
    const allMessages = (historyResult.data || []).reverse();
    const summary = conversationResult.data?.summary;

    // Count tokens from newest to oldest, keeping messages that fit the budget
    let tokenCount = 0;
    let cutoffIndex = 0; // Index where we start including messages
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(allMessages[i].content as string);
      if (tokenCount + msgTokens > HISTORY_TOKEN_BUDGET) {
        cutoffIndex = i + 1;
        break;
      }
      tokenCount += msgTokens;
    }

    const recentMessages = allMessages.slice(cutoffIndex);

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Only prepend summary when some messages were cut off (history exceeded budget)
    if (cutoffIndex > 0 && summary) {
      conversationHistory.push(
        { role: 'user', content: `[Previous conversation summary: ${summary}]` },
        { role: 'assistant', content: 'Understood, I have the context from our earlier discussion.' },
      );
    }

    // Ensure the first real message has role 'user' for valid API alternation.
    // If the window starts with an assistant message, skip it (summary covers it).
    let startIdx = 0;
    if (recentMessages.length > 0 && recentMessages[0].role === 'assistant') {
      startIdx = 1;
    }

    for (let i = startIdx; i < recentMessages.length; i++) {
      conversationHistory.push({
        role: recentMessages[i].role as 'user' | 'assistant',
        content: recentMessages[i].content,
      });
    }

    // Save profile data as persistent user memories (fire-and-forget)
    if (profile_data) {
      const { industry, workStyle, services, teamSize } = profile_data;
      const profileFacts: string[] = [];
      if (industry) profileFacts.push(`User's industry is ${industry}`);
      if (workStyle) profileFacts.push(`User's work style is ${workStyle}`);
      if (services) profileFacts.push(`User's services/products: ${services}`);
      if (teamSize) profileFacts.push(`User's team size is ${teamSize}`);

      if (profileFacts.length > 0) {
        (async () => {
          try {
            await adminClient
              .from('user_memories')
              .delete()
              .eq('user_id', authUser.id)
              .eq('workspace_id', workspace_id)
              .eq('category', 'profile');
            await adminClient.from('user_memories').insert(
              profileFacts.map(fact => ({
                user_id: authUser.id,
                workspace_id,
                category: 'profile',
                content: fact,
                source_conversation_id: conversation_id,
              })),
            );
          } catch (err) {
            console.error('[setup/chat] Profile memory save failed:', err);
          }
        })();
      }
    }

    // Enrich message with file context if the user attached files
    const enrichedMessage = file_context
      ? `${message.trim()}\n\n--- ATTACHED FILE CONTENT ---\n${file_context}\n--- END ATTACHED FILE CONTENT ---`
      : message.trim();

    // -----------------------------------------------------------------------
    // PHASE 2: Call the AI brain.
    // Conversation history from DB already includes all messages (including
    // the one the user just sent), so the AI always has full context.
    // -----------------------------------------------------------------------

    const result = await handleSetupMessage({
      userMessage: enrichedMessage,
      workspaceId: workspace_id,
      userId: authUser.id,
      conversationId: conversation_id,
      conversationHistory,
      precomputedAnalysis: workspace_analysis || undefined,
      planTier,
      proposedPlan: proposed_plan || undefined,
      chatStructureSnapshot: chat_structure_snapshot || undefined,
      profileData: profile_data || undefined,
    });

    // -----------------------------------------------------------------------
    // PHASE 3: Save AI response immediately, then send response to client.
    // Credits and summarization happen AFTER the client gets the response.
    // -----------------------------------------------------------------------

    // Save assistant message right away (don't wait for billing)
    await adminClient.from('messages').insert({
      workspace_id,
      conversation_id,
      role: 'assistant',
      content: result.content,
      credits_used: result.creditsToCharge,
      metadata: {
        source: 'setup',
        tool_calls: result.toolCalls,
        anthropic_cost_cents: result.anthropicCostCents,
      },
    });

    // Fire-and-forget: billing, summarization, session updates.
    // These don't block the response to the client.
    (async () => {
      try {
        await adminClient.rpc('deduct_credits', {
          p_workspace_id: workspace_id,
          p_user_id: authUser.id,
          p_amount: result.creditsToCharge,
          p_description: 'Setup: workspace configuration',
          p_message_id: null,
          p_metadata: {
            credit_tier: 'premium',
            source: 'setup',
            input_tokens: result.totalInputTokens,
            output_tokens: result.totalOutputTokens,
            anthropic_cost_cents: result.anthropicCostCents,
            tool_calls: result.toolCalls,
          },
        });
      } catch (err) {
        console.error('[setup/chat] Credit deduction failed:', err);
      }

      try {
        await adminClient.from('credit_usage').insert({
          user_id: authUser.id,
          workspace_id,
          action_type: 'chat',
          session_id: conversation_id,
          model_used: 'sonnet',
          input_tokens: result.totalInputTokens ?? 0,
          output_tokens: result.totalOutputTokens ?? 0,
          anthropic_cost_cents: result.anthropicCostCents ?? 0,
          credits_deducted: result.creditsToCharge,
        });
      } catch (err) {
        console.error('[setup/chat] credit_usage insert failed:', err);
      }

      try {
        await adminClient
          .from('setup_sessions')
          .update({
            credits_used: adminClient.rpc('add_setup_credits', {
              p_conversation_id: conversation_id,
              p_amount: result.creditsToCharge,
            }),
          })
          .eq('conversation_id', conversation_id);
      } catch (err) {
        console.error('[setup/chat] setup_sessions update failed:', err);
      }

      // Summarize only when the conversation has exceeded the token budget.
      // For most setup conversations (10-30 messages) this never triggers,
      // meaning full history is always available and no context is lost.
      const totalHistoryTokens = allMessages.reduce(
        (sum: number, m: { role: string; content: string }) => sum + estimateTokens(m.content as string), 0
      );
      if (totalHistoryTokens > HISTORY_TOKEN_BUDGET) {
        maybeSummarizeConversation(conversation_id, workspace_id).catch(err =>
          console.error('[setup/chat] Background summarization failed:', err),
        );
      }
    })();

    return NextResponse.json({
      content: result.content,
      credits_consumed: result.creditsToCharge,
      tool_calls: result.toolCalls,
      // Return extracted structure snapshot so the client can persist it
      ...(result.structureSnapshot ? { structure_snapshot: result.structureSnapshot } : {}),
    });
  } catch (error) {
    console.error('[POST /api/setup/chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup error' },
      { status: 500 },
    );
  }
}
