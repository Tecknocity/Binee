// B-020: Subscription credit grant logic
// Grants monthly credits to a workspace based on its plan tier.
// Called by Stripe webhook on subscription renewal (B-090) or manually.
// Uses reset_subscription_credits RPC to reset the subscription pool
// without affecting PAYG credits.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PLAN_TIERS, type PlanTier } from '@/billing/config';

interface GrantResult {
  success: boolean;
  error?: string;
  credits_granted?: number;
  new_balance?: number;
  subscription_balance?: number;
  paygo_balance?: number;
  transaction_id?: string;
}

/**
 * Grants monthly subscription credits to a workspace.
 * Uses the service role client for server-side operations.
 * Subscription credits do not roll over - the subscription pool is reset
 * to the plan's monthly amount. PAYG credits are unaffected.
 */
export async function grantSubscriptionCredits(
  workspaceId: string,
  userId: string,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>;
    planOverride?: string;
  },
): Promise<GrantResult> {
  const supabase = options?.supabase ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch workspace to determine plan
  const { data: workspace, error: fetchError } = await supabase
    .from('workspaces')
    .select('id, plan, credit_balance, subscription_balance, paygo_balance, owner_id')
    .eq('id', workspaceId)
    .single();

  if (fetchError || !workspace) {
    return { success: false, error: 'Workspace not found' };
  }

  const plan = options?.planOverride ?? workspace.plan;
  const tierConfig = PLAN_TIERS[plan as PlanTier];

  // Only subscription tiers get monthly credit grants
  if (!tierConfig) {
    return { success: false, error: 'No subscription plan. Monthly credit grants are not available.' };
  }

  const monthlyCredits = tierConfig.credits;

  // Reset subscription pool via atomic RPC (paygo untouched)
  const { data, error: rpcError } = await supabase.rpc('reset_subscription_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: monthlyCredits,
    p_description: `Monthly subscription credit grant for ${plan} plan`,
    p_metadata: {
      plan,
      previous_subscription_balance: workspace.subscription_balance,
      credits_granted: monthlyCredits,
    },
  });

  if (rpcError) {
    return { success: false, error: rpcError.message };
  }

  const result = data as { success: boolean; transaction_id?: string; balance?: number; subscription_balance?: number; paygo_balance?: number; error?: string };

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    credits_granted: monthlyCredits,
    new_balance: result.balance,
    subscription_balance: result.subscription_balance,
    paygo_balance: result.paygo_balance,
    transaction_id: result.transaction_id,
  };
}
