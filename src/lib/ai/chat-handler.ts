// src/lib/ai/chat-handler.ts
// REWRITTEN — Master Agent + Sub-Agent Architecture

import Anthropic from '@anthropic-ai/sdk';
import { MASTER_AGENT_PROMPT } from './prompts/master-agent';
import { executeSubAgent } from './sub-agent-executor';
import { executeTool } from './tool-executor';
import { buildContext } from './context';
import {
  isWriteOperation,
  isBlockedOperation,
  createPendingAction,
  buildPendingConfirmationResult,
  buildBlockedOperationResult,
  getOperationTrustTier,
} from './confirmation';
import { checkSufficientCredits } from './billing';
import { calculateAnthropicCost } from '@/billing/engine/token-converter';
import { classifyMessageCost } from '@/billing/engine/flat-credit-classifier';
import { SUB_AGENT_TOOLS, DIRECT_TOOLS } from './tools';
import type { ChatRequest, AssistantResponse, ToolCallResult, BineeContext } from '@/types/ai';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

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
// Response types
// ---------------------------------------------------------------------------

export interface ChatHandlerResponse extends AssistantResponse {
  _billing?: unknown;
}

// ---------------------------------------------------------------------------
// Main chat handler — Master Agent + Sub-Agent Architecture
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 5;
const MASTER_MODEL = 'claude-sonnet-4-6';
const MASTER_MAX_TOKENS = 4096;

const SUB_AGENT_NAMES = new Set(['task_manager', 'workspace_analyst', 'setupper', 'dashboard_builder']);

function isSubAgentTool(name: string): boolean {
  return SUB_AGENT_NAMES.has(name);
}

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

  const client = getAnthropicClient();

  // 1. Pre-check workspace credit balance (B-049)
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
      model_used: MASTER_MODEL,
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

  // 3. Build context
  const context = await buildContext(workspace_id, user_id, conversation_id);
  const clickUpConnected = context.workspace.clickup_connected;

  // 4. Build system prompt with context
  const systemPrompt = buildMasterSystem(MASTER_AGENT_PROMPT, context);

  // 5. Fetch conversation history
  const conversationHistory = context.conversationHistory.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Add current message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: message },
  ];

  // 6. Get all tools (sub-agent tools + direct tools)
  // Only include ClickUp tools if ClickUp is connected
  const allTools = clickUpConnected
    ? [...SUB_AGENT_TOOLS, ...DIRECT_TOOLS]
    : [];

  // Add web search for general queries
  const webSearchTool = [{ type: 'web_search_20250305' as const, name: 'web_search' as const }];

  // 7. Master agent tool loop
  const allToolCalls: ToolCallResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let pendingActionData: {
    id: string;
    tool_name: string;
    trust_tier: 'low' | 'medium' | 'high';
    description: string;
    details: string;
  } | null = null;
  let apiMessages = [...messages];

  // Use Anthropic prompt caching
  const systemWithCache: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: systemPrompt,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  // Apply cache_control to the last custom tool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsWithCache: any[] = [];
  for (let i = 0; i < allTools.length; i++) {
    const tool = allTools[i];
    if (i === allTools.length - 1) {
      toolsWithCache.push({ ...tool, cache_control: { type: 'ephemeral' as const } });
    } else {
      toolsWithCache.push(tool);
    }
  }
  // Append web search server tool after custom tools (no cache_control)
  toolsWithCache.push(...webSearchTool);

  let finalContent = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MASTER_MODEL,
        max_tokens: MASTER_MAX_TOKENS,
        system: systemWithCache,
        ...(toolsWithCache.length > 0 ? { tools: toolsWithCache } : {}),
        messages: apiMessages,
      });
    } catch (e) {
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

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process content blocks
    const textBlocks: string[] = [];
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
    }

    // If no tool uses, we have our final response
    if (toolUseBlocks.length === 0) {
      finalContent = textBlocks.join('\n');
      break;
    }

    // Append the assistant's response to messages
    apiMessages.push({ role: 'assistant', content: response.content });

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let hasWriteInterception = false;

    for (const toolUse of toolUseBlocks) {
      const toolName = toolUse.name;
      const toolInput = toolUse.input as Record<string, unknown>;

      // Check if this is a sub-agent tool
      if (isSubAgentTool(toolName)) {
        const subAgentResult = await executeSubAgent(
          client,
          toolName as 'task_manager' | 'workspace_analyst' | 'setupper' | 'dashboard_builder',
          toolInput.request as string,
          context,
          workspace_id,
        );

        // Track sub-agent tool calls
        for (const tc of subAgentResult.toolCalls) {
          allToolCalls.push({
            tool_name: tc.name,
            tool_input: tc.input,
            result: tc.result,
            success: true,
          });
        }
        totalInputTokens += subAgentResult.tokensInput;
        totalOutputTokens += subAgentResult.tokensOutput;

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: subAgentResult.content,
        });
      }
      // Check if blocked
      else if (isBlockedOperation(toolName)) {
        const result = buildBlockedOperationResult(toolName);
        allToolCalls.push({
          tool_name: toolName,
          tool_input: toolInput,
          result,
          success: false,
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
          is_error: true,
        });
      }
      // Check if this is a write operation that needs confirmation
      else if (isWriteOperation(toolName)) {
        const pendingAction = await createPendingAction(
          workspace_id,
          conversation_id,
          toolName,
          toolInput,
        );
        const result = buildPendingConfirmationResult(pendingAction);

        allToolCalls.push({
          tool_name: toolName,
          tool_input: toolInput,
          result,
          success: true,
        });
        hasWriteInterception = true;
        pendingActionData = {
          id: pendingAction.id,
          tool_name: toolName,
          trust_tier: getOperationTrustTier(toolName),
          description: pendingAction.description,
          details: pendingAction.details,
        };
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      // Regular read tool — execute directly
      else {
        const result = await executeTool(toolName, toolInput, workspace_id);
        const success = result.success !== false;
        allToolCalls.push({
          tool_name: toolName,
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
    }

    // Add tool results to messages
    apiMessages.push({ role: 'user', content: toolResults });

    // B-045: If a write operation was intercepted, let the model produce one
    // more response to inform the user, then stop the loop.
    if (hasWriteInterception && round < MAX_TOOL_ROUNDS - 1) {
      const confirmResponse = await client.messages.create({
        model: MASTER_MODEL,
        max_tokens: MASTER_MAX_TOKENS,
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

  // 8. Flat credit billing — charge based on what happened, not tokens
  const subAgentCallCount = allToolCalls.filter(tc => SUB_AGENT_NAMES.has(tc.tool_name)).length;
  const isSetupRequest = allToolCalls.some(tc => tc.tool_name === 'setupper');
  const messageCost = classifyMessageCost(subAgentCallCount, isSetupRequest);
  const creditCost = messageCost.creditsToCharge;

  // Analytics only — track actual Anthropic cost for margin monitoring
  const anthropicCost = calculateAnthropicCost({
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    model: 'sonnet',
  });

  let billingResult = null;
  try {
    const { data, error: deductError } = await supabase.rpc('deduct_credits', {
      p_workspace_id: workspace_id,
      p_user_id: user_id,
      p_amount: creditCost,
      p_description: 'Chat: master_agent',
      p_message_id: null,
      p_metadata: {
        credit_tier: messageCost.tier,
        model: MASTER_MODEL,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        anthropic_cost_cents: anthropicCost.totalCostCents,
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
      action_type: 'master_agent',
      model_used: 'sonnet',
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      anthropic_cost_cents: anthropicCost.totalCostCents,
      credits_deducted: creditCost,
      credit_tier: messageCost.tier,
    });
  } catch (err) {
    console.error('[chat-handler] usage tracking insert failed:', err);
  }

  // 9. Save assistant message + return response
  await saveAssistantMessage(
    supabase,
    conversation_id,
    workspace_id,
    finalContent,
    MASTER_MODEL,
    creditCost,
    totalInputTokens,
    totalOutputTokens,
    allToolCalls.length > 0 ? allToolCalls : null,
  );

  return {
    content: finalContent,
    model_used: MASTER_MODEL,
    credits_consumed: creditCost,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
    pending_action: pendingActionData,
    _billing: billingResult ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Build master system prompt with workspace context
// ---------------------------------------------------------------------------

function buildMasterSystem(basePrompt: string, context: BineeContext): string {
  const contextBlock = `

---

## CURRENT SESSION

User: ${context.user.display_name} (${context.user.role})
Workspace: ${context.workspace.name}
ClickUp: ${context.workspace.clickup_connected ? 'Connected' : 'Not connected'}
Credits: ${context.workspace.credit_balance}
${context.workspace.clickup_connected && context.workspace.last_sync_at
    ? `Last sync: ${context.workspace.last_sync_at}`
    : ''}
`;

  // Add company profile if available
  const ws = context.workspace as Record<string, unknown>;
  const companyProfile = (ws.company_name || ws.industry || ws.team_size || ws.primary_use_case)
    ? `
Company: ${ws.company_name || 'Unknown'}
Industry: ${ws.industry || 'Unknown'}
Team size: ${ws.team_size || 'Unknown'}
Primary use: ${ws.primary_use_case || 'Unknown'}
`
    : '';

  return basePrompt + contextBlock + companyProfile;
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
