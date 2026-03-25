import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDisplayBalance, getBalanceBreakdown } from '@/billing/engine/balance-calculator';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: account, error } = await supabaseAdmin
    .from('user_credit_accounts')
    .select('subscription_balance, subscription_plan_credits, paygo_balance')
    .eq('user_id', userId)
    .single();

  if (error || !account) {
    return NextResponse.json({
      displayBalance: 0,
      subscription: 0,
      paygo: 0,
    });
  }

  const breakdown = getBalanceBreakdown(account);

  return NextResponse.json({
    displayBalance: getDisplayBalance(account),
    subscription: breakdown.subscriptionCredits,
    subscriptionPlanCredits: account.subscription_plan_credits,
    paygo: breakdown.paygoCredits,
  });
}
