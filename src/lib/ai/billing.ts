import type { TaskType } from '@/types/ai';
import { getModelForTask } from '@/lib/ai/router';
import { CREDIT_COSTS } from '@/lib/credits/costs';
import type { DeductResult } from '@/lib/credits/types';

// ---------------------------------------------------------------------------
// Credit cost calculation for AI interactions (B-049)
// ---------------------------------------------------------------------------

/**
 * Credit cost tiers:
 *   Haiku            = 1 credit
 *   Sonnet (simple)  = 3 credits
 *   Sonnet (complex) = 5 credits
 *
 * "Complex" Sonnet task types: setup_request, strategy
 */
const COMPLEX_SONNET_TASKS: Set<TaskType> = new Set([
  'setup_request',
  'strategy',
]);

/**
 * Calculate the credit cost for an AI interaction based on task type,
 * model used, and token count.
 *
 * The primary cost driver is task type (which determines the model).
 * Token count is available for future graduated pricing but does not
 * currently affect the cost.
 */
export function calculateCreditCost(
  taskType: TaskType,
  modelUsed: string,
  tokenCount: number = 0,
): number {
  const routing = getModelForTask(taskType);

  // Use the router's credit cost as the source of truth
  // This keeps billing in sync with the routing table in router.ts
  if (routing) {
    return routing.creditCost;
  }

  // Fallback: determine cost from model tier + complexity
  if (modelUsed.includes('haiku')) {
    return CREDIT_COSTS.SIMPLE_CHAT; // 1
  }

  if (COMPLEX_SONNET_TASKS.has(taskType)) {
    return CREDIT_COSTS.STRATEGIC_CHAT; // 5
  }

  return CREDIT_COSTS.COMPLEX_CHAT; // 3
}

// ---------------------------------------------------------------------------
// Insufficient credits check
// ---------------------------------------------------------------------------

export interface InsufficientCreditsError {
  type: 'insufficient_credits';
  required: number;
  available: number;
  message: string;
}

/**
 * Check whether a workspace has enough credits for the given task.
 * Returns null if sufficient, or an error object if not.
 */
export function checkSufficientCredits(
  balance: number,
  creditCost: number,
): InsufficientCreditsError | null {
  if (balance >= creditCost) {
    return null;
  }

  return {
    type: 'insufficient_credits',
    required: creditCost,
    available: balance,
    message:
      'You have insufficient credits to process this request. Please upgrade your plan or purchase additional credits.',
  };
}

// ---------------------------------------------------------------------------
// Post-response credit deduction
// ---------------------------------------------------------------------------

/**
 * Deduct credits after a successful AI response.
 *
 * Uses the Supabase admin client (service role) and the atomic
 * `deduct_credits` RPC to prevent race conditions.
 *
 * @returns The deduction result from the RPC, or an error result.
 */
export async function deductCreditsForAIResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: {
    workspaceId: string;
    userId: string;
    creditCost: number;
    taskType: TaskType;
    modelId: string;
    tokenUsage?: Record<string, number>;
    messageId?: string;
  },
): Promise<DeductResult> {
  const { workspaceId, userId, creditCost, taskType, modelId, tokenUsage, messageId } = params;

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: creditCost,
    p_description: `Chat: ${taskType}`,
    p_message_id: messageId ?? null,
    p_metadata: {
      task_type: taskType,
      model: modelId,
      ...(tokenUsage ? { token_usage: tokenUsage } : {}),
    },
  });

  if (error) {
    console.error('[billing] Credit deduction failed:', error.message);
    return { success: false, error: error.message };
  }

  return data as DeductResult;
}
