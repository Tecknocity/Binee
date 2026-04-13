import { NextRequest, NextResponse } from 'next/server';
import { handleSetupMessage } from '@/lib/setup/setupper-brain';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { maybeSummarizeConversation } from '@/lib/ai/conversation-summary';

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
      // Last 10 messages (recent context) - older context comes from summary,
      // and the chat structure snapshot carries key structural decisions
      adminClient
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Conversation summary (compressed context from older messages)
      adminClient
        .from('conversations')
        .select('summary')
        .eq('id', conversation_id)
        .single(),
    ]);

    const planTier = workspaceResult.data?.clickup_plan_tier || 'free';

    // Build conversation history: summary + recent messages
    // This follows the same pattern as the general chat (context.ts:580-629)
    // so older context is preserved via summary, not lost when messages exceed the limit.
    const recentMessages = (historyResult.data || []).reverse();
    const summary = conversationResult.data?.summary;

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (summary && recentMessages.length > 0) {
      conversationHistory.push(
        { role: 'user', content: `[Previous conversation summary: ${summary}]` },
        { role: 'assistant', content: 'Understood, I have the context from our earlier discussion.' },
      );
    }

    for (const m of recentMessages) {
      conversationHistory.push({
        role: m.role as 'user' | 'assistant',
        content: m.content,
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

      maybeSummarizeConversation(conversation_id, workspace_id).catch(err =>
        console.error('[setup/chat] Background summarization failed:', err),
      );
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
