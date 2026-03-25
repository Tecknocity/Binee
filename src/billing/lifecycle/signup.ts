import { FREE_SIGNUP_CREDITS } from '../config';
import { logCreditTransaction } from '../services/transaction-logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Handle new user signup — grants free credits to PAYG pool.
 *
 * NOTE: The Supabase handle_new_user() trigger (migration 024) already creates
 * billing rows on signup. This function is for cases where the trigger didn't
 * fire (e.g., manual user creation) or as a fallback in the post-signup flow.
 * Uses ON CONFLICT to avoid duplicates.
 */
export async function handleSignup(userId: string) {
  // Create credit account with free credits in PAYG pool
  const { error: creditError } = await supabaseAdmin
    .from('user_credit_accounts')
    .upsert(
      {
        user_id: userId,
        subscription_balance: 0,
        subscription_plan_credits: 0,
        paygo_balance: FREE_SIGNUP_CREDITS,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (creditError) throw new Error(`Failed to create credit account: ${creditError.message}`);

  // Create empty subscription record
  const { error: subError } = await supabaseAdmin
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'none',
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (subError) throw new Error(`Failed to create subscription record: ${subError.message}`);

  await logCreditTransaction({
    userId,
    type: 'signup_bonus',
    creditsAdded: FREE_SIGNUP_CREDITS,
    pool: 'paygo',
    amountPaidCents: 0,
    description: `Signup bonus: ${FREE_SIGNUP_CREDITS} free credits`,
  });
}
