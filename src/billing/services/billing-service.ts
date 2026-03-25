import { tokensToCredits } from '../engine/token-converter';
import { checkCreditWarnings } from '../engine/warning-checker';
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
// Types
// ---------------------------------------------------------------------------

interface ProcessAIUsageParams {
  userId: string;
  actionType: 'chat' | 'health_check' | 'setup' | 'dashboard' | 'briefing';
  sessionId: string;
  model: 'haiku' | 'sonnet' | 'opus';
  inputTokens: number;
  outputTokens: number;
}

interface ProcessAIUsageResult {
  blocked: boolean;
  creditsDeducted?: number;
  newDisplayBalance?: number;
  warning?: {
    warning_type: 'low' | 'critical' | 'empty';
    message?: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Main orchestrator — called after every AI interaction
// ---------------------------------------------------------------------------

/**
 * Process AI usage after an Anthropic API response.
 *
 * 1. Convert tokens to credits via conversion rates
 * 2. Atomically deduct credits (SQL function with row locking)
 * 3. Check for warning thresholds
 */
export async function processAIUsage(
  params: ProcessAIUsageParams,
): Promise<ProcessAIUsageResult> {
  // Step 1: Convert tokens to credits
  const conversion = tokensToCredits({
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    model: params.model,
  });

  // Step 2: Atomic deduction (calls the SQL function)
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('deduct_user_credits', {
    p_user_id: params.userId,
    p_credits_to_deduct: conversion.creditsConsumed,
    p_action_type: params.actionType,
    p_session_id: params.sessionId,
    p_model_used: params.model,
    p_input_tokens: params.inputTokens,
    p_output_tokens: params.outputTokens,
    p_anthropic_cost_cents: conversion.totalCostCents,
  });

  if (error || !data?.success) {
    // User has no credits — return blocked status
    return {
      blocked: true,
      warning: { warning_type: 'empty' as const, message: "You've used all your credits. Purchase more to continue." },
    };
  }

  // Step 3: Check warnings on new balances
  const warning = checkCreditWarnings({
    subscription_balance: data.new_subscription_balance,
    paygo_balance: data.new_paygo_balance,
  });

  return {
    blocked: false,
    creditsDeducted: conversion.creditsConsumed,
    newDisplayBalance: data.new_display_balance,
    warning: warning
      ? { warning_type: warning.warning_type, message: warning.message }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Pre-check — called BEFORE sending to Anthropic
// ---------------------------------------------------------------------------

/**
 * Check if a user has credits available to start an AI action.
 *
 * CRITICAL: This runs BEFORE sending to Anthropic. A user can start an
 * action with 1 credit and consume 3 — this is by design. The current
 * action finishes, then the user is blocked on the next one.
 */
export async function canUserAct(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_credit_accounts')
    .select('subscription_balance, paygo_balance')
    .eq('user_id', userId)
    .single();

  if (!data) return false;
  return (data.subscription_balance + data.paygo_balance) > 0;
}
