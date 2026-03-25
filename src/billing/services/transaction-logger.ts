import { supabaseAdmin } from '@/lib/supabase-admin';

interface LogTransactionParams {
  userId: string;
  type: 'signup_bonus' | 'subscription_renewal' | 'subscription_upgrade' | 'paygo_purchase' | 'setup_purchase';
  creditsAdded: number;
  pool: 'subscription' | 'paygo';
  amountPaidCents: number;
  description: string;
}

export async function logCreditTransaction(params: LogTransactionParams) {
  const { error } = await supabaseAdmin.from('user_credit_transactions').insert({
    user_id: params.userId,
    type: params.type,
    credits_added: params.creditsAdded,
    pool: params.pool,
    amount_paid_cents: params.amountPaidCents,
    description: params.description,
  });

  if (error) throw new Error(`Failed to log credit transaction: ${error.message}`);
}
