import { allocateMonthlyCredits } from '@/billing/lifecycle/renewal';
import { processExpiredSubscription } from '@/billing/lifecycle/cancellation';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Daily Credit Allocation Cron Job
 * Schedule: Every day at 00:05 UTC
 *
 * Handles two flows:
 * 1. Annual plan credit allocations (monthly drip independent of Stripe)
 * 2. Expired cancellations (both monthly and annual)
 *
 * NOTE: Monthly plan allocations are NOT processed here — they happen
 * in the Stripe invoice.paid webhook because allocation is tied to payment.
 */
export async function processDailyCreditAllocations() {
  const now = new Date();
  const nowIso = now.toISOString();
  const results = { allocated: 0, expired: 0, skipped: 0, errors: 0 };

  // ============================================
  // STEP 1: Process ANNUAL plan credit allocations
  // ============================================
  // Annual plans drip credits monthly via this cron.
  // Check: is it allocation day AND is the subscription still within its paid period?

  const { data: annualDue, error: annualError } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id, plan_tier, annual_end_date, cancel_at_period_end')
    .eq('status', 'active')
    .eq('billing_period', 'annual')
    .lte('next_credit_allocation_date', nowIso);

  if (annualError) {
    console.error('Failed to fetch annual allocations:', annualError.message);
  }

  for (const sub of annualDue || []) {
    try {
      // Safeguard: is the annual period still active?
      if (sub.annual_end_date && new Date(sub.annual_end_date) < now) {
        // Annual period expired — Stripe renewal must have failed
        console.log(`Skipping annual allocation for ${sub.user_id}: annual_end_date expired`);
        results.skipped++;
        continue;
      }

      // Safeguard: is cancellation pending?
      if (sub.cancel_at_period_end) {
        // User cancelled — check if we're past their paid period
        if (sub.annual_end_date && new Date(sub.annual_end_date) < now) {
          await processExpiredSubscription(sub.user_id);
          results.expired++;
          continue;
        }
        // Still within paid period — give them their credits
      }

      // All checks passed — allocate monthly credits
      await allocateMonthlyCredits(sub.user_id, sub.plan_tier);
      console.log(`Allocated ${sub.plan_tier} credits to annual user ${sub.user_id}`);
      results.allocated++;
    } catch (err) {
      console.error(`Failed to allocate credits for ${sub.user_id}:`, err);
      results.errors++;
    }
  }

  // ============================================
  // STEP 2: Process expired cancellations (both monthly and annual)
  // ============================================
  // For subscriptions that were cancelled and the period has ended

  const { data: expiredCancellations, error: cancelError } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id, billing_period, annual_end_date, current_period_end')
    .eq('cancel_at_period_end', true)
    .eq('status', 'active');

  if (cancelError) {
    console.error('Failed to fetch expired cancellations:', cancelError.message);
  }

  for (const sub of expiredCancellations || []) {
    try {
      const endDate = sub.billing_period === 'annual'
        ? sub.annual_end_date
        : sub.current_period_end;

      if (endDate && new Date(endDate) < now) {
        await processExpiredSubscription(sub.user_id);
        console.log(`Processed expired cancellation for ${sub.user_id}`);
        results.expired++;
      }
    } catch (err) {
      console.error(`Failed to process expired cancellation for ${sub.user_id}:`, err);
      results.errors++;
    }
  }

  return results;
}
