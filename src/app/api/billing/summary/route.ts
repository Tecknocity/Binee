import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDisplayBalance, getBalanceBreakdown } from '@/billing/engine/balance-calculator';

/**
 * GET /api/billing/summary
 *
 * Combined endpoint returning both credit balance and subscription data
 * in a single request. This avoids duplicate auth overhead and halves
 * the number of round-trips compared to calling /credits + /subscription
 * separately.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch credit account and subscription in parallel
  const [accountResult, subscriptionResult] = await Promise.all([
    supabaseAdmin
      .from('user_credit_accounts')
      .select('subscription_balance, subscription_plan_credits, paygo_balance')
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single(),
  ]);

  const account = accountResult.data;
  const subscription = subscriptionResult.error ? null : subscriptionResult.data;

  let credits;
  if (!account) {
    credits = {
      displayBalance: 0,
      subscription: 0,
      subscriptionPlanCredits: 0,
      paygo: 0,
    };
  } else {
    const breakdown = getBalanceBreakdown(account);
    credits = {
      displayBalance: getDisplayBalance(account),
      subscription: breakdown.subscriptionCredits,
      subscriptionPlanCredits: account.subscription_plan_credits,
      paygo: breakdown.paygoCredits,
    };
  }

  return NextResponse.json({
    credits,
    subscription: subscription ?? null,
  });
}
