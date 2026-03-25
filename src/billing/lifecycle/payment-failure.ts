import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Handle payment failure — non-punitive.
 *
 * User keeps existing credits, just doesn't get new ones.
 * - PAYG credits remain fully usable
 * - For annual plans: cron won't allocate if status is 'past_due'
 * - For monthly: no invoice.paid webhook fires, so no allocation happens
 * - Stripe retries payment per its own schedule
 */
export async function handlePaymentFailure(userId: string) {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to mark payment failure: ${error.message}`);
}

/**
 * Handle payment recovery — Stripe successfully retried the charge.
 * Restores subscription to active so credit allocations resume.
 */
export async function handlePaymentRecovery(userId: string) {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to restore subscription: ${error.message}`);
}
