import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatRequest,
  AssistantResponse,
  ToolCallResult,
} from '@/types/ai';
import { classifyMessage } from '@/lib/ai/classifier';
import { getModelForTask, routeToModel } from '@/lib/ai/router';
import { buildSystemPrompt, buildSetupPrompt, buildHealthPrompt, buildDashboardPrompt } from '@/lib/ai/prompts';
import { loadSystemPrompt } from '@/lib/ai/prompts/system-prompt';
import { buildContext } from '@/lib/ai/context';
import { BINEE_TOOLS } from '@/lib/ai/tools';
import { executeTool } from '@/lib/ai/tool-executor';
import {
  isWriteOperation,
  isBlockedOperation,
  createPendingAction,
  buildPendingConfirmationResult,
  buildBlockedOperationResult,
  getOperationTrustTier,
} from '@/lib/ai/confirmation';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ---------------------------------------------------------------------------
// Supabase admin client
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
// Main chat handler
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 5;

export async function handleChatMessage(
  request: ChatRequest,
): Promise<AssistantResponse> {
  const { workspace_id, user_id, conversation_id, message } = request;

  // 1. Classify the message
  const classification = classifyMessage(message);

  // 2. Get model routing
  const routing = getModelForTask(classification.taskType);
  const modelConfig = routeToModel(classification.taskType);

  // 3. Check credit balance
  const supabase = getSupabaseAdmin();
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspace_id)
    .single();

  if (wsError || !workspace) {
    throw new Error(`Workspace not found: ${wsError?.message ?? 'unknown error'}`);
  }

  if (workspace.credit_balance < routing.creditCost) {
    return {
      content:
        'You have insufficient credits to process this request. Please upgrade your plan or purchase additional credits.',
      model_used: routing.modelId,
      credits_consumed: 0,
      tool_calls: null,
      tokens_input: 0,
      tokens_output: 0,
    };
  }

  // 4. Build context
  const context = await buildContext(workspace_id, user_id, conversation_id, classification.taskType);

  // 5. Determine if ClickUp is connected — controls tool availability
  const clickUpConnected = context.workspace.clickup_connected;

  // 6. Build system prompt — load from knowledge base with dynamic context
  const systemPrompt = await loadSystemPrompt(context, {
    taskType: classification.taskType,
  });

  // 7. Build message history for the API
  const messages: Anthropic.MessageParam[] = [
    // Include conversation history
    ...context.conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    // Add the current message
    { role: 'user' as const, content: message },
  ];

  // 8. Call Anthropic API with tool use loop
  // Only provide tools when ClickUp is connected — this enforces at the API level
  // that the AI cannot call workspace tools without a connection.
  // Chat still works standalone for general conversations (credits are consumed).
  const toolsForApi = clickUpConnected ? BINEE_TOOLS : [];

  const allToolCalls: ToolCallResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = '';
  let pendingActionData: {
    id: string;
    tool_name: string;
    trust_tier: 'low' | 'medium' | 'high';
    description: string;
    details: string;
  } | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      system: systemPrompt,
      ...(toolsForApi.length > 0 ? { tools: toolsForApi } : {}),
      messages,
    });

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

    // If there are no tool uses, we have our final response
    if (toolUseBlocks.length === 0) {
      finalContent = textBlocks.join('\n');
      break;
    }

    // Append the assistant's response (with tool_use blocks) to messages
    messages.push({ role: 'assistant', content: response.content });

    // Execute each tool call and collect results
    // B-045: Write operations are intercepted for user confirmation.
    //        Blocked operations (deletions) are rejected immediately.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let hasWriteInterception = false;

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;
      let result: Record<string, unknown>;
      let success: boolean;

      if (isBlockedOperation(toolUse.name)) {
        // Hard block — deletions are never allowed
        result = buildBlockedOperationResult(toolUse.name);
        success = false;
      } else if (isWriteOperation(toolUse.name)) {
        // Intercept write operation — create pending action for confirmation
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
        // Read-only operation — execute immediately
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
    messages.push({ role: 'user', content: toolResults });

    // B-045: If a write operation was intercepted, let the model produce one
    // more response so it can tell the user about the pending confirmation,
    // then stop the loop — we don't want further tool calls until confirmed.
    if (hasWriteInterception && round < MAX_TOOL_ROUNDS - 1) {
      const confirmResponse = await anthropic.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        system: systemPrompt,
        ...(toolsForApi.length > 0 ? { tools: toolsForApi } : {}),
        messages,
      });

      totalInputTokens += confirmResponse.usage.input_tokens;
      totalOutputTokens += confirmResponse.usage.output_tokens;

      const confirmTextBlocks: string[] = [];
      for (const block of confirmResponse.content) {
        if (block.type === 'text') {
          confirmTextBlocks.push(block.text);
        }
      }

      finalContent = confirmTextBlocks.join('\n') ||
        'I need your confirmation before executing this action. Please review the details above and confirm or cancel.';
      break;
    }

    // If this was the last round, we'll break out and use whatever text we have
    if (round === MAX_TOOL_ROUNDS - 1) {
      finalContent =
        textBlocks.join('\n') ||
        'I completed the requested actions. Let me know if you need anything else.';
    }
  }

  // 9. Deduct credits (always deducted — chat works standalone, tokens are consumed)
  await supabase.rpc('deduct_credits', {
    p_workspace_id: workspace_id,
    p_user_id: user_id,
    p_amount: routing.creditCost,
    p_description: `Chat: ${classification.taskType}`,
    p_metadata: { task_type: classification.taskType, model: routing.modelId },
  });

  // 10. Save message and response to the database
  await saveConversationMessages(
    supabase,
    conversation_id,
    workspace_id,
    user_id,
    message,
    finalContent,
    routing.modelId,
    routing.creditCost,
    totalInputTokens,
    totalOutputTokens,
    allToolCalls.length > 0 ? allToolCalls : null,
    classification.taskType,
  );

  // 11. Return the response
  return {
    content: finalContent,
    model_used: routing.modelId,
    credits_consumed: routing.creditCost,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
    // B-045: Include pending action data when a write operation awaits confirmation
    pending_action: pendingActionData,
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
    // Upsert the conversation (create if first message)
    await supabase
      .from('conversations')
      .upsert(
        {
          id: conversationId,
          workspace_id: workspaceId,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    // Insert the user message
    await supabase.from('messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      credits_used: 0,
    });

    // Insert the assistant message with metadata
    await supabase.from('messages').insert({
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
  } catch (error) {
    // Log but don't fail the response if message saving fails
    console.error('Failed to save conversation messages:', error);
  }
}
