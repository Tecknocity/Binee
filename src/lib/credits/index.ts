// Credit system barrel export
// The old free/starter/pro tiers have been replaced by the credit-based plans
// in src/billing/config.ts (100/150/250/500/750/1000/2000 credits)

export { PLAN_TIERS, type PlanTier } from '@/billing/config';
export { MESSAGE_CREDIT_TIERS, type MessageTier } from '@/billing/config';
export { grantSubscriptionCredits } from '@/lib/credits/grants';

import { createBrowserClient } from '@/lib/supabase/client';
import type { CreditTransaction, DeductCreditsResult, AddCreditsResult, ResetSubscriptionCreditsResult } from '@/types/database';

export async function deductCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string,
  messageId?: string,
  metadata: Record<string, unknown> = {},
): Promise<DeductCreditsResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_message_id: messageId ?? null,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as DeductCreditsResult;
}

export async function addCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'refund' | 'monthly_reset' | 'subscription_grant',
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<AddCreditsResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('add_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as AddCreditsResult;
}

export async function resetSubscriptionCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<ResetSubscriptionCreditsResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('reset_subscription_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as ResetSubscriptionCreditsResult;
}

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error || !data) return 0;
  return data.credit_balance;
}

export async function getCreditHistory(
  workspaceId: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CreditTransaction[];
}
