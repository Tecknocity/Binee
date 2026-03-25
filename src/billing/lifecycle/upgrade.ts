import { PLAN_TIERS } from '../config';
import { logCreditTransaction } from '../services/transaction-logger';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PlanTier } from '../types/subscriptions';

/**
 * Handle mid-cycle upgrade — adds credit difference immediately.
 *
 * When user upgrades (e.g., 100 → 250), the difference (150) is added
 * to subscription pool right away. Uses atomic SQL RPC to prevent races.
 */
export async function handleUpgrade(userId: string, oldTier: PlanTier, newTier: PlanTier) {
  const oldCredits = PLAN_TIERS[oldTier].credits;
  const newCredits = PLAN_TIERS[newTier].credits;
  const difference = newCredits - oldCredits;

  if (difference <= 0) throw new Error('Upgrade must be to a higher tier');

  // Add credit difference to subscription pool immediately (atomic)
  const { error: rpcError } = await supabaseAdmin.rpc('add_subscription_credits', {
    p_user_id: userId,
    p_credits: difference,
  });

  if (rpcError) throw new Error(`Failed to add upgrade credits: ${rpcError.message}`);

  // Update subscription record to new tier
  const { error: subError } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      plan_tier: newTier,
      pending_plan_change: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (subError) throw new Error(`Failed to update subscription tier: ${subError.message}`);

  await logCreditTransaction({
    userId,
    type: 'subscription_upgrade',
    creditsAdded: difference,
    pool: 'subscription',
    amountPaidCents: 0,
    description: `Upgrade from ${oldCredits} to ${newCredits} credits: +${difference} credits added`,
  });
}
