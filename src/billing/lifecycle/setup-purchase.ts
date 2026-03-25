import { SETUP_FEE_CENTS, SETUP_CREDITS } from '../config';
import { logCreditTransaction } from '../services/transaction-logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Handle workspace setup purchase — adds credits to PAYG pool.
 * Uses atomic SQL RPC to prevent race conditions.
 */
export async function handleSetupPurchase(userId: string) {
  const { error } = await supabaseAdmin.rpc('add_paygo_credits', {
    p_user_id: userId,
    p_credits: SETUP_CREDITS,
  });

  if (error) throw new Error(`Failed to add setup credits: ${error.message}`);

  await logCreditTransaction({
    userId,
    type: 'setup_purchase',
    creditsAdded: SETUP_CREDITS,
    pool: 'paygo',
    amountPaidCents: SETUP_FEE_CENTS,
    description: `Workspace setup purchase: ${SETUP_CREDITS} credits`,
  });
}
