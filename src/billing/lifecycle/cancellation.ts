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
 * Wipes subscription credits on the workspace and resets subscription to 'none'.
 * PAYG balance is untouched.
 */
export async function processExpiredSubscription(userId: string) {
  // Find workspace owned by this user
  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('id, subscription_balance, paygo_balance')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  if (ws) {
    // Zero out subscription pool; keep paygo intact
    const newTotal = ws.paygo_balance ?? 0;
    const { error: creditError } = await supabaseAdmin
      .from('workspaces')
      .update({
        subscription_balance: 0,
        credit_balance: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ws.id);

    if (creditError) throw new Error(`Failed to wipe subscription credits: ${creditError.message}`);

    // Record the wipe as a transaction for audit trail
    await supabaseAdmin.from('credit_transactions').insert({
      workspace_id: ws.id,
      user_id: userId,
      amount: -(ws.subscription_balance ?? 0),
      balance_after: newTotal,
      type: 'subscription_grant',
      description: 'Subscription expired - subscription credits removed',
      metadata: {
        pool: 'subscription',
        reset: true,
        previous_subscription_balance: ws.subscription_balance,
        new_subscription_balance: 0,
        paygo_balance: ws.paygo_balance,
        reason: 'subscription_expired',
      },
    });
  }

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
