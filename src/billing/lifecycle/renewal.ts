import { PLAN_TIERS, CREDIT_ALLOCATION_INTERVAL_DAYS } from '../config';
import { logCreditTransaction } from '../services/transaction-logger';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PlanTier } from '../types/subscriptions';

/**
 * Core credit allocation — called by both:
 * - Daily cron (annual plans — credits drip monthly independent of Stripe)
 * - Stripe invoice.paid webhook (monthly plans — allocation tied to payment)
 *
 * Wipes remaining subscription credits (no rollover) and refills to plan amount.
 * Also applies any pending plan change (downgrade scheduled from previous cycle).
 */
export async function allocateMonthlyCredits(userId: string, planTier: PlanTier) {
  const tierConfig = PLAN_TIERS[planTier];

  // Wipe remaining subscription credits (no rollover) and set fresh allocation
  const { error: updateError } = await supabaseAdmin
    .from('user_credit_accounts')
    .update({
      subscription_balance: tierConfig.credits,
      subscription_plan_credits: tierConfig.credits,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) throw new Error(`Failed to allocate credits: ${updateError.message}`);

  // Advance next allocation date by ~30 days
  const nextAllocation = new Date();
  nextAllocation.setDate(nextAllocation.getDate() + CREDIT_ALLOCATION_INTERVAL_DAYS);

  const { error: subUpdateError } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      next_credit_allocation_date: nextAllocation.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (subUpdateError) throw new Error(`Failed to update allocation date: ${subUpdateError.message}`);

  // Check for pending plan change (downgrade scheduled from previous cycle)
  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('pending_plan_change')
    .eq('user_id', userId)
    .single();

  if (sub?.pending_plan_change) {
    await supabaseAdmin
      .from('user_subscriptions')
      .update({
        plan_tier: sub.pending_plan_change,
        pending_plan_change: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  await logCreditTransaction({
    userId,
    type: 'subscription_renewal',
    creditsAdded: tierConfig.credits,
    pool: 'subscription',
    amountPaidCents: 0, // Payment tracked by Stripe, not here
    description: `Monthly credit allocation: ${tierConfig.credits} credits`,
  });
}
