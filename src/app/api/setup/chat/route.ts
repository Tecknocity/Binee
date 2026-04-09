import { NextRequest, NextResponse } from 'next/server';
import { handleSetupMessage } from '@/lib/setup/setupper-brain';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { maybeSummarizeConversation } from '@/lib/ai/conversation-summary';

export const maxDuration = 60;

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
    const { workspace_id, conversation_id, message, workspace_analysis, proposed_plan, profile_data, file_context } = body;

    if (!workspace_id || !conversation_id || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load templates from knowledge base
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: templateModules } = await adminClient
      .from('ai_knowledge_base')
      .select('content')
      .like('module_key', 'clickup-templates-database%');

    const templates = templateModules?.map(m => m.content).join('\n\n') || '';

    // Fetch ClickUp plan tier for this workspace
    const { data: workspaceRow } = await adminClient
      .from('workspaces')
      .select('clickup_plan_tier')
      .eq('id', workspace_id)
      .single();
    const planTier = workspaceRow?.clickup_plan_tier || 'free';

    // Load conversation history for this setup session
    const { data: historyMessages } = await adminClient
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (historyMessages || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Save profile data as persistent user memories (fire-and-forget, non-blocking).
    // This ensures the user's company identity is available in ALL future conversations
    // (both setup and regular chat) without waiting for the summarizer to extract it.
    if (profile_data) {
      const { industry, workStyle, services, teamSize } = profile_data;
      const profileFacts: string[] = [];
      if (industry) profileFacts.push(`User's industry is ${industry}`);
      if (workStyle) profileFacts.push(`User's work style is ${workStyle}`);
      if (services) profileFacts.push(`User's services/products: ${services}`);
      if (teamSize) profileFacts.push(`User's team size is ${teamSize}`);

      if (profileFacts.length > 0) {
        // Delete old profile memories and insert fresh ones (handles profile updates)
        adminClient
          .from('user_memories')
          .delete()
          .eq('user_id', authUser.id)
          .eq('workspace_id', workspace_id)
          .eq('category', 'profile')
          .then(() =>
            adminClient.from('user_memories').insert(
              profileFacts.map(fact => ({
                user_id: authUser.id,
                workspace_id,
                category: 'profile',
                content: fact,
                source_conversation_id: conversation_id,
              })),
            ),
          )
          .catch(err => console.error('[setup/chat] Profile memory save failed:', err));
      }
    }

    // Enrich message with file context if the user attached files
    const enrichedMessage = file_context
      ? `${message.trim()}\n\n--- ATTACHED FILE CONTENT ---\n${file_context}\n--- END ATTACHED FILE CONTENT ---`
      : message.trim();

    // Run setupper brain — pass pre-computed analysis if available
    const result = await handleSetupMessage({
      userMessage: enrichedMessage,
      workspaceId: workspace_id,
      userId: authUser.id,
      conversationId: conversation_id,
      conversationHistory,
      templates,
      precomputedAnalysis: workspace_analysis || undefined,
      planTier,
      proposedPlan: proposed_plan || undefined,
      profileData: profile_data || undefined,
    });

    // Deduct credits
    const { error: deductError } = await adminClient.rpc('deduct_credits', {
      p_workspace_id: workspace_id,
      p_user_id: authUser.id,
      p_amount: result.creditsToCharge,
      p_description: 'Setup: workspace configuration',
      p_message_id: null,
      p_metadata: {
        credit_tier: 'complex',
        source: 'setup',
        input_tokens: result.totalInputTokens,
        output_tokens: result.totalOutputTokens,
        anthropic_cost_cents: result.anthropicCostCents,
        tool_calls: result.toolCalls,
      },
    });

    if (deductError) {
      console.error('[setup/chat] Credit deduction failed:', deductError);
    }

    // Log to credit_usage (same source of truth as chat)
    const { error: usageErr } = await adminClient.from('credit_usage').insert({
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
    if (usageErr) {
      console.error('[setup/chat] credit_usage insert failed:', usageErr.message);
    }

    // Ensure conversation record exists (needed for summarization)
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

    // Save messages
    await adminClient.from('messages').insert([
      {
        workspace_id,
        conversation_id,
        role: 'user',
        content: message.trim(),
        credits_used: 0,
      },
      {
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
      },
    ]);

    // Fire-and-forget: summarize conversation every 4 messages (async, non-blocking)
    maybeSummarizeConversation(conversation_id, workspace_id).catch(err =>
      console.error('[setup/chat] Background summarization failed:', err),
    );

    // Update setup session credits_used
    await adminClient
      .from('setup_sessions')
      .update({
        credits_used: adminClient.rpc('add_setup_credits', {
          p_conversation_id: conversation_id,
          p_amount: result.creditsToCharge,
        }),
      })
      .eq('conversation_id', conversation_id);

    return NextResponse.json({
      content: result.content,
      credits_consumed: result.creditsToCharge,
      tool_calls: result.toolCalls,
    });
  } catch (error) {
    console.error('[POST /api/setup/chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup error' },
      { status: 500 },
    );
  }
}
