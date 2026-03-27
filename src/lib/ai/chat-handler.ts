import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatRequest,
  AssistantResponse,
  ToolCallResult,
  TaskType,
} from '@/types/ai';
import { classifyMessage } from '@/lib/ai/classifier';
import { getModelForTask, routeToModel } from '@/lib/ai/router';
import { loadSystemPrompt } from '@/lib/ai/prompts/system-prompt';
import { assemblePrompt } from '@/lib/ai/prompt-assembler';
import { buildContext } from '@/lib/ai/context';
import { getToolsForTask } from '@/lib/ai/tools';
import { executeTool } from '@/lib/ai/tool-executor';
import {
  isWriteOperation,
  isBlockedOperation,
  createPendingAction,
  buildPendingConfirmationResult,
  buildBlockedOperationResult,
  getOperationTrustTier,
} from '@/lib/ai/confirmation';
import {
  validateResponse,
  buildFallbackResponse,
  applyHallucinationDisclaimer,
  logValidationViolations,
} from '@/lib/ai/response-validator';
import type { ValidationResult } from '@/lib/ai/response-validator';
import {
  checkSufficientCredits,
} from '@/lib/ai/billing';
import { tokensToCredits } from '@/billing/engine/token-converter';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

/** Timeout for each Anthropic API call (45s — leaves headroom for Vercel's 60s limit) */
const ANTHROPIC_TIMEOUT_MS = 45_000;

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not configured. Please add it to your environment variables.',
      );
    }
    _anthropic = new Anthropic({
      apiKey,
      timeout: ANTHROPIC_TIMEOUT_MS,
    });
  }
  return _anthropic;
}

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
// Orchestration metadata (for observability)
// ---------------------------------------------------------------------------

export interface OrchestrationMetadata {
  classification: {
    taskType: TaskType;
    confidence: number;
    reasoning: string;
  };
  routing: {
    model: string;
    modelId: string;
    creditCost: number;
  };
  tokenUsage: {
    system: number;
    kbSummary: number;
    brainModules: number;
    context: number;
    history: number;
    promptTotal: number;
    apiInput: number;
    apiOutput: number;
  };
  toolRounds: number;
  validation: ValidationResult;
}

// ---------------------------------------------------------------------------
// Extended response type with orchestration metadata
// ---------------------------------------------------------------------------

export interface ChatHandlerResponse extends AssistantResponse {
  /** Billing result metadata */
  _billing?: unknown;
  /** Orchestration metadata for debugging and observability */
  _orchestration?: OrchestrationMetadata;
}

// ---------------------------------------------------------------------------
// Main chat handler — orchestration (B-046)
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 5;

/**
 * Main AI chat orchestration function.
 *
 * Flow:
 *   1. Receive user message + conversation context
 *   2. B-037: Classify message -> task_type
 *   3. B-038: Route to model (Haiku vs Sonnet) based on task_type
 *   4. B-KB: Fetch matching brain modules from ai_knowledge_base
 *   5. B-041: Build workspace context (Business State Document)
 *   6. B-042: Assemble prompt (system + brain modules + context + history)
 *   7. Call Claude API with assembled prompt
 *   8. B-048: Validate response
 *   9. B-018: Deduct credits
 *  10. Return response to frontend
 */
export async function handleChat(
  request: ChatRequest,
): Promise<ChatHandlerResponse> {
  const { workspace_id, user_id, conversation_id, message } = request;

  // -------------------------------------------------------------------------
  // Step 1-2: Classify the message (B-037)
  // Fetch the last 2 messages from conversation history so short follow-ups
  // like "try again", "do it", "yes" are classified in context of what was
  // previously discussed — not as general_chat with no tools.
  // -------------------------------------------------------------------------
  console.log('[handleChat] Step 1: classifying message');

  let conversationContext: string | undefined;
  try {
    let supabaseForContext: ReturnType<typeof getSupabaseAdmin>;
    try {
      supabaseForContext = getSupabaseAdmin();
    } catch {
      supabaseForContext = null as unknown as ReturnType<typeof getSupabaseAdmin>;
    }
    if (supabaseForContext) {
      const { data: recentMessages } = await supabaseForContext
        .from('messages')
        .select('content')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(2);
      if (recentMessages && recentMessages.length > 0) {
        conversationContext = recentMessages
          .reverse()
          .map((m) => m.content)
          .join('\n');
      }
    }
  } catch {
    // Non-critical — proceed without context
  }

  const classification = classifyMessage(message, conversationContext);

  // -------------------------------------------------------------------------
  // Step 3: Route to model (B-038)
  // -------------------------------------------------------------------------
  const routing = getModelForTask(classification.taskType);
  const modelConfig = routeToModel(classification.taskType);
  console.log(`[handleChat] Step 2: routed to ${modelConfig.model} for task "${classification.taskType}"`);

  // -------------------------------------------------------------------------
  // Step 3b: Pre-check workspace credit balance before proceeding (B-049)
  // -------------------------------------------------------------------------
  // We check if the workspace has at least 1 credit. The actual cost is
  // calculated after the API call (token-based). By design, the current
  // action always completes — the user is blocked on the *next* action.
  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    throw new Error(`Supabase config error: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log('[handleChat] Step 3: checking credits');
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspace_id)
    .single();

  if (wsError || !workspace) {
    throw new Error(`Workspace not found (id: ${workspace_id}): ${wsError?.message ?? 'no data returned'}`);
  }

  const insufficientCredits = checkSufficientCredits(Math.floor(workspace.credit_balance), 1);
  if (insufficientCredits) {
    return {
      content: insufficientCredits.message,
      model_used: routing.modelId,
      credits_consumed: 0,
      tool_calls: null,
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Step 3c: Save user message immediately (before AI call).
  // This ensures the message is persisted even if the AI call fails, times
  // out, or the user closes the browser. Similar to how Claude.ai saves the
  // user message the moment you hit send.
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Step 4-5: Build workspace context (B-041) + fetch brain modules (B-KB)
  // -------------------------------------------------------------------------
  console.log('[handleChat] Step 4: building context');
  let context: Awaited<ReturnType<typeof buildContext>>;
  try {
    context = await buildContext(workspace_id, user_id, conversation_id, classification.taskType);
  } catch (e) {
    throw new Error(`Context build failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const clickUpConnected = context.workspace.clickup_connected;

  // -------------------------------------------------------------------------
  // Step 6: Assemble prompt with token budgeting (B-042)
  // -------------------------------------------------------------------------
  console.log('[handleChat] Step 5: assembling prompt');
  let assembled: Awaited<ReturnType<typeof assemblePrompt>>;
  try {
    const baseSystemPrompt = await loadSystemPrompt(context, {
      taskType: classification.taskType,
    });

    assembled = await assemblePrompt(
      baseSystemPrompt,
      context,
      context.conversationHistory,
      classification.taskType,
      { currentMessage: message },
    );
  } catch (e) {
    throw new Error(`Prompt assembly failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // -------------------------------------------------------------------------
  // Step 7: Call Claude API with tool use loop
  // -------------------------------------------------------------------------
  console.log('[handleChat] Step 6: calling Claude API');
  const customTools = (clickUpConnected && classification.taskType !== 'general_chat')
    ? getToolsForTask(classification.taskType)
    : [];

  // Anthropic server-side web search tool — lets Claude search the web for
  // real-time data (weather, news, prices, etc.) without a third-party API.
  // Added for general_chat and simple_lookup so Binee can answer real-time questions.
  const WEB_SEARCH_TASK_TYPES = new Set(['general_chat', 'simple_lookup', 'complex_query', 'strategy', 'troubleshooting']);
  const webSearchTool = WEB_SEARCH_TASK_TYPES.has(classification.taskType)
    ? [{ type: 'web_search_20250305' as const, name: 'web_search' as const }]
    : [];

  const toolsForApi = [...customTools, ...webSearchTool];
  const allToolCalls: ToolCallResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = '';
  let toolRounds = 0;
  let pendingActionData: {
    id: string;
    tool_name: string;
    trust_tier: 'low' | 'medium' | 'high';
    description: string;
    details: string;
  } | null = null;

  // Use the assembled messages for the API call; they already include
  // token-budgeted history + the current user message.
  const apiMessages: Anthropic.MessageParam[] = [...assembled.messages];

  // Use Anthropic prompt caching: the system prompt and tool definitions
  // are identical across rounds within a conversation, so marking them
  // as ephemeral lets Anthropic cache them (90% cost reduction on hits).
  const systemWithCache: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: assembled.system,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  // Apply cache_control to the last custom tool (not the web search server tool).
  // Server tools like web_search don't support cache_control.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsWithCache: any[] = [];
  for (let i = 0; i < customTools.length; i++) {
    const tool = customTools[i];
    if (i === customTools.length - 1) {
      toolsWithCache.push({ ...tool, cache_control: { type: 'ephemeral' as const } });
    } else {
      toolsWithCache.push(tool);
    }
  }
  // Append web search server tool after custom tools (no cache_control)
  toolsWithCache.push(...webSearchTool);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    toolRounds = round + 1;

    let response: Anthropic.Message;
    try {
      response = await getAnthropicClient().messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        system: systemWithCache,
        ...(toolsWithCache.length > 0 ? { tools: toolsWithCache } : {}),
        messages: apiMessages,
      });
    } catch (e) {
      // Parse Anthropic SDK errors into user-friendly messages instead of
      // exposing raw JSON error bodies to the frontend.
      const raw = e instanceof Error ? e.message : String(e);
      let userMessage: string;
      if (raw.includes('rate_limit') || raw.includes('429')) {
        userMessage = 'Rate limit reached — please try again in a moment.';
      } else if (raw.includes('overloaded') || raw.includes('529')) {
        userMessage = 'The AI service is temporarily overloaded. Please try again shortly.';
      } else if (raw.includes('authentication') || raw.includes('401')) {
        userMessage = 'AI service authentication error. Please contact support.';
      } else if (raw.includes('timeout') || raw.includes('timed out')) {
        userMessage = 'The AI request timed out. Please try again with a simpler question.';
      } else {
        userMessage = 'An error occurred while processing your request. Please try again.';
      }
      console.error(`[handleChat] Anthropic API error (round ${round + 1}):`, raw);
      throw new Error(userMessage);
    }
    console.log(`[handleChat] Claude responded (round ${round + 1}, ${response.usage.output_tokens} tokens)`);

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process content blocks
    // Server tool blocks (web_search_tool_result, etc.) are informational —
    // Anthropic handles them internally. We only process text and custom tool_use.
    const textBlocks: string[] = [];
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
      // server_tool_use, web_search_tool_result blocks are handled by Anthropic
    }

    // If no tool uses, we have our final response
    if (toolUseBlocks.length === 0) {
      finalContent = textBlocks.join('\n');
      break;
    }

    // Append the assistant's response (with tool_use blocks) to messages
    apiMessages.push({ role: 'assistant', content: response.content });

    // Execute each tool call and collect results
    // B-045: Write operations intercepted for user confirmation
    //        Blocked operations (deletions) rejected immediately
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let hasWriteInterception = false;

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;
      let result: Record<string, unknown>;
      let success: boolean;

      if (isBlockedOperation(toolUse.name)) {
        result = buildBlockedOperationResult(toolUse.name);
        success = false;
      } else if (isWriteOperation(toolUse.name)) {
        const pendingAction = await createPendingAction(
          workspace_id,
          conversation_id,
          toolUse.name,
          toolInput,
        );
        result = buildPendingConfirmationResult(pendingAction);
        success = true;
        hasWriteInterception = true;
        pendingActionData = {
          id: pendingAction.id,
          tool_name: toolUse.name,
          trust_tier: getOperationTrustTier(toolUse.name),
          description: pendingAction.description,
          details: pendingAction.details,
        };
      } else {
        result = await executeTool(toolUse.name, toolInput, workspace_id);
        success = result.success !== false;
      }

      allToolCalls.push({
        tool_name: toolUse.name,
        tool_input: toolInput,
        result,
        success,
        error: success ? undefined : (result.error as string),
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        is_error: !success,
      });
    }

    // Add tool results to messages for the next round
    apiMessages.push({ role: 'user', content: toolResults });

    // B-045: If a write operation was intercepted, let the model produce one
    // more response to inform the user, then stop the loop.
    if (hasWriteInterception && round < MAX_TOOL_ROUNDS - 1) {
      const confirmResponse = await getAnthropicClient().messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        system: systemWithCache,
        ...(toolsWithCache.length > 0 ? { tools: toolsWithCache } : {}),
        messages: apiMessages,
      });

      totalInputTokens += confirmResponse.usage.input_tokens;
      totalOutputTokens += confirmResponse.usage.output_tokens;

      const confirmTextBlocks: string[] = [];
      for (const block of confirmResponse.content) {
        if (block.type === 'text') {
          confirmTextBlocks.push(block.text);
        }
      }

      finalContent =
        confirmTextBlocks.join('\n') ||
        'I need your confirmation before executing this action. Please review the details above and confirm or cancel.';
      break;
    }

    // If this was the last round, use whatever text we have
    if (round === MAX_TOOL_ROUNDS - 1) {
      finalContent =
        textBlocks.join('\n') ||
        'I completed the requested actions. Let me know if you need anything else.';
    }
  }

  // -------------------------------------------------------------------------
  // Step 8: Validate response — hallucination guard (B-048)
  // -------------------------------------------------------------------------
  const validation = validateResponse(
    finalContent,
    classification.taskType,
    allToolCalls,
    context.businessState,
  );

  if (!validation.valid) {
    // Log violations for quality monitoring
    logValidationViolations(classification.taskType, validation.issues, finalContent);

    // Critical issues → replace with fallback
    const fallback = buildFallbackResponse(validation.issues);
    if (fallback) {
      finalContent = fallback;
    } else {
      // Non-critical (e.g. hallucinated numbers) → append disclaimer
      finalContent = applyHallucinationDisclaimer(finalContent, validation.issues);
    }
  }

  // -------------------------------------------------------------------------
  // Step 9: Deduct credits from WORKSPACE pool (B-049)
  // -------------------------------------------------------------------------
  // Token-based cost — exact fractional value, no rounding.
  // The database stores the precise amount; frontend shows Math.floor().
  const conversion = tokensToCredits({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: routing.model as 'haiku' | 'sonnet' | 'opus',
  });
  // Round to 4 decimal places to match numeric(12,4) column
  const creditCost = Math.round(conversion.creditsConsumed * 10000) / 10000;

  // Atomic deduction from workspace pool via SQL RPC (row-locked)
  let billingResult = null;
  try {
    const { data, error: deductError } = await supabase.rpc('deduct_credits', {
      p_workspace_id: workspace_id,
      p_user_id: user_id,
      p_amount: creditCost,
      p_description: `Chat: ${classification.taskType}`,
      p_message_id: null,
      p_metadata: {
        task_type: classification.taskType,
        model: routing.modelId,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        anthropic_cost_cents: conversion.totalCostCents,
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

  // Log per-user usage for analytics (admin can see who burns what).
  // This does NOT deduct from any balance — purely tracking.
  try {
    await supabase.from('credit_usage').insert({
      user_id: user_id,
      workspace_id: workspace_id,
      action_type: classification.taskType,
      model_used: routing.model,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      anthropic_cost_cents: conversion.totalCostCents,
      credits_deducted: creditCost,
    });
  } catch (err) {
    // Non-critical — don't block the response
    console.error('[chat-handler] usage tracking insert failed:', err);
  }

  // -------------------------------------------------------------------------
  // Step 10: Save messages + return response
  // -------------------------------------------------------------------------
  await saveConversationMessages(
    supabase,
    conversation_id,
    workspace_id,
    user_id,
    message,
    finalContent,
    routing.modelId,
    creditCost,
    totalInputTokens,
    totalOutputTokens,
    allToolCalls.length > 0 ? allToolCalls : null,
    classification.taskType,
  );

  return {
    content: finalContent,
    model_used: routing.modelId,
    credits_consumed: creditCost,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
    pending_action: pendingActionData,
    _billing: billingResult ?? undefined,
    _orchestration: {
      classification: {
        taskType: classification.taskType,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
      },
      routing: {
        model: routing.model,
        modelId: routing.modelId,
        creditCost,
      },
      tokenUsage: {
        system: assembled.tokenUsage.system,
        kbSummary: assembled.tokenUsage.kbSummary,
        brainModules: assembled.tokenUsage.brainModules,
        context: assembled.tokenUsage.context,
        history: assembled.tokenUsage.history,
        promptTotal: assembled.tokenUsage.total,
        apiInput: totalInputTokens,
        apiOutput: totalOutputTokens,
      },
      toolRounds,
      validation,
    },
  };
}

// ---------------------------------------------------------------------------
// Persist messages to database
// ---------------------------------------------------------------------------

async function saveConversationMessages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  workspaceId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  modelUsed: string,
  creditsConsumed: number,
  tokensInput: number,
  tokensOutput: number,
  toolCalls: ToolCallResult[] | null,
  taskType: string,
): Promise<void> {
  try {
    // User message + conversation are already saved at the start of handleChat
    // (Step 3c). Only save the assistant response here.
    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Insert the assistant message with metadata
    const { error: asstMsgErr } = await supabase.from('messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage,
      credits_used: creditsConsumed,
      metadata: {
        model_used: modelUsed,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        tool_calls: toolCalls,
        task_type: taskType,
      },
    });
    if (asstMsgErr) {
      console.error('[chat-handler] Assistant message insert failed:', asstMsgErr.message);
    }
  } catch (error) {
    console.error('[chat-handler] Failed to save conversation messages:', error);
  }
}
