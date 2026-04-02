// src/lib/ai/chat-handler.ts
// REWRITTEN — Router → Sub-Agent → Brain Architecture

import { orchestrate } from '@/lib/ai/orchestrator';
import { buildSlimContext } from '@/lib/ai/context';
import { checkSufficientCredits } from './billing';
import { maybeSummarizeConversation } from '@/lib/ai/conversation-summary';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import type { ChatRequest, AssistantResponse, ToolCallResult } from '@/types/ai';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase admin client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  return createClient(url, serviceKey);
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ChatHandlerResponse extends AssistantResponse {
  _billing?: unknown;
}

// ---------------------------------------------------------------------------
// Main chat handler — Router → Sub-Agent → Brain Architecture
// ---------------------------------------------------------------------------

const ORCHESTRATOR_MODEL = 'claude-sonnet-4-20250514';

export async function handleChat(
  request: ChatRequest,
): Promise<ChatHandlerResponse> {
  const { workspace_id, user_id, conversation_id, message } = request;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    throw new Error(`Supabase config error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 1. Pre-check workspace credit balance (B-049)
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspace_id)
    .single();

  if (wsError || !workspace) {
    throw new Error(`Workspace not found (id: ${workspace_id}): ${wsError?.message ?? 'no data returned'}`);
  }

  const insufficientCredits = checkSufficientCredits(Math.round(workspace.credit_balance), 1);
  if (insufficientCredits) {
    return {
      content: insufficientCredits.message,
      model_used: ORCHESTRATOR_MODEL,
      credits_consumed: 0,
      tool_calls: null,
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  // 2. Save user message immediately
  const { error: convUpsertErr } = await supabase
    .from('conversations')
    .upsert(
      {
        id: conversation_id,
        workspace_id,
        user_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (convUpsertErr) {
    console.error('[handleChat] Conversation upsert failed:', convUpsertErr.message);
  }

  const { error: userMsgErr } = await supabase.from('messages').insert({
    workspace_id,
    conversation_id,
    role: 'user',
    content: message,
    credits_used: 0,
  });
  if (userMsgErr) {
    console.error('[handleChat] User message early-save failed:', userMsgErr.message);
  }

  // 3. Build slim context for the new pipeline
  const context = await buildSlimContext(workspace_id, user_id, conversation_id);

  // 4. Orchestrate: Router → Sub-Agents → Brain
  const result = await orchestrate({
    userMessage: message,
    workspaceId: workspace_id,
    userId: user_id,
    conversationId: conversation_id,
    workspaceStructure: context.workspaceStructure,
    userContext: context.userContext,
    conversationSummary: context.conversationSummary,
    conversationHistory: context.conversationHistory,
    recentMessages: context.recentMessages,
  });

  // 5. Flat credit billing — charge based on what happened, not tokens
  const creditCost = result.creditClassification.creditsToCharge;

  let billingResult = null;
  try {
    const { data, error: deductError } = await supabase.rpc('deduct_credits', {
      p_workspace_id: workspace_id,
      p_user_id: user_id,
      p_amount: creditCost,
      p_description: 'Chat: orchestrator',
      p_message_id: null,
      p_metadata: {
        credit_tier: result.creditClassification.tier,
        model: result.modelUsed,
        input_tokens: result.totalInputTokens,
        output_tokens: result.totalOutputTokens,
        anthropic_cost_cents: result.anthropicCost.totalCostCents,
        route: result.routeDecision.route,
        sub_agents: result.subAgentResults.map(r => r.agent),
      },
    });
    if (deductError) {
      console.error('[chat-handler] workspace credit deduction failed:', deductError.message);
    } else {
      billingResult = data;
    }
  } catch (err) {
    console.error('[chat-handler] workspace credit deduction failed:', err);
  }

  // Log per-user usage for analytics
  try {
    await supabase.from('credit_usage').insert({
      user_id,
      workspace_id,
      action_type: 'orchestrator',
      model_used: 'sonnet',
      input_tokens: result.totalInputTokens,
      output_tokens: result.totalOutputTokens,
      anthropic_cost_cents: result.anthropicCost.totalCostCents,
      credits_deducted: creditCost,
      credit_tier: result.creditClassification.tier,
    });
  } catch (err) {
    console.error('[chat-handler] usage tracking insert failed:', err);
  }

  // Build tool calls from sub-agent results for response metadata
  const toolCalls: ToolCallResult[] = result.subAgentResults.flatMap(r =>
    r.toolCalls.map(name => ({
      tool_name: name,
      tool_input: {},
      result: { summary: r.summary },
      success: !r.error,
      error: r.error,
    })),
  );

  // 6. Save assistant message + return response
  await saveAssistantMessage(
    supabase,
    conversation_id,
    workspace_id,
    result.content,
    result.modelUsed,
    creditCost,
    result.totalInputTokens,
    result.totalOutputTokens,
    toolCalls.length > 0 ? toolCalls : null,
  );

  // Fire-and-forget: summarize if needed (don't block response)
  maybeSummarizeConversation(conversation_id, workspace_id).catch(err =>
    console.error('[chat-handler] Background summarization error:', err),
  );

  return {
    content: result.content,
    model_used: result.modelUsed,
    credits_consumed: creditCost,
    tool_calls: toolCalls.length > 0 ? toolCalls : null,
    tokens_input: result.totalInputTokens,
    tokens_output: result.totalOutputTokens,
    _billing: billingResult ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Persist assistant message to database
// ---------------------------------------------------------------------------

async function saveAssistantMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  workspaceId: string,
  assistantMessage: string,
  modelUsed: string,
  creditsConsumed: number,
  tokensInput: number,
  tokensOutput: number,
  toolCalls: ToolCallResult[] | null,
): Promise<void> {
  try {
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    const { error: asstMsgErr } = await supabase.from('messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage,
      credits_used: Math.round(creditsConsumed),
      metadata: {
        model_used: modelUsed,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        tool_calls: toolCalls,
        credits_exact: creditsConsumed,
      },
    });
    if (asstMsgErr) {
      console.error('[chat-handler] Assistant message insert failed:', asstMsgErr.message);
    }
  } catch (error) {
    console.error('[chat-handler] Failed to save assistant message:', error);
  }
}
