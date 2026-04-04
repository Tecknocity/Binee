// B-020: Subscription credit grant logic
// Grants monthly credits to a workspace based on its plan tier.
// Called by Stripe webhook on subscription renewal (B-090) or manually.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PLAN_TIERS, type PlanTier } from '@/billing/config';

interface GrantResult {
  success: boolean;
  error?: string;
  credits_granted?: number;
  new_balance?: number;
  transaction_id?: string;
}

/**
 * Grants monthly subscription credits to a workspace.
 * Uses the service role client for server-side operations.
 * Credits do not roll over — balance is reset to the plan's monthly amount.
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
    .select('id, plan, credit_balance, owner_id')
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

  // Reset balance to plan amount (no rollover)
  const { error: updateError } = await supabase
    .from('workspaces')
    .update({
      credit_balance: monthlyCredits,
      credits_reset_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Record the subscription grant transaction
  const { data: transaction, error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      amount: monthlyCredits - workspace.credit_balance,
      balance_after: monthlyCredits,
      type: 'subscription_grant',
      description: `Monthly subscription credit grant for ${plan} plan`,
      metadata: {
        plan,
        previous_balance: workspace.credit_balance,
        credits_granted: monthlyCredits,
      },
    })
    .select('id')
    .single();

  if (txError) {
    return { success: false, error: txError.message };
  }

  return {
    success: true,
    credits_granted: monthlyCredits,
    new_balance: monthlyCredits,
    transaction_id: transaction?.id,
  };
}
