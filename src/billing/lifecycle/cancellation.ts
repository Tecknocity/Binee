import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Handle subscription cancellation — user keeps credits until period ends.
 * PAYG balance is completely unaffected.
 *
 * The cron job or webhook will call processExpiredSubscription() when
 * the subscription period actually ends.
 */
export async function handleCancellation(userId: string) {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to mark cancellation: ${error.message}`);
}

/**
 * Called by cron or webhook when subscription actually expires.
 * Wipes subscription credits and resets subscription to 'none'.
 * PAYG balance is untouched.
 */
export async function processExpiredSubscription(userId: string) {
  const { error: creditError } = await supabaseAdmin
    .from('user_credit_accounts')
    .update({
      subscription_balance: 0,
      subscription_plan_credits: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (creditError) throw new Error(`Failed to wipe subscription credits: ${creditError.message}`);

  const { error: subError } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'none',
      plan_tier: null,
      billing_period: null,
      cancel_at_period_end: false,
      next_credit_allocation_date: null,
      annual_end_date: null,
      payment_provider_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (subError) throw new Error(`Failed to reset subscription: ${subError.message}`);
}
