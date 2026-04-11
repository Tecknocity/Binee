import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/billing/summary
 *
 * Combined endpoint returning workspace credit balance and subscription data.
 * Credits are workspace-scoped — all team members see the same balance.
 * Subscription metadata is still per-user (the owner's subscription).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch workspace balance and subscription in parallel
  const [memberResult, subscriptionResult] = await Promise.all([
    supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const subscription = subscriptionResult.error ? null : subscriptionResult.data;

  let credits;
  if (!memberResult.data) {
    credits = {
      displayBalance: 0,
      subscription: 0,
      subscriptionPlanCredits: 0,
      paygo: 0,
    };
  } else {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('credit_balance, subscription_balance, paygo_balance, plan')
      .eq('id', memberResult.data.workspace_id)
      .single();

    const subBalance = workspace?.subscription_balance ?? 0;
    const paygoBalance = workspace?.paygo_balance ?? 0;
    const totalBalance = workspace?.credit_balance ?? (subBalance + paygoBalance);

    // Look up plan credits for display
    const plan = workspace?.plan;
    let planCredits = 0;
    if (plan) {
      const { PLAN_TIERS } = await import('@/billing/config');
      const tierConfig = PLAN_TIERS[plan as keyof typeof PLAN_TIERS];
      if (tierConfig) planCredits = tierConfig.credits;
    }

    credits = {
      displayBalance: Math.floor(totalBalance),
      subscription: Math.floor(subBalance * 100) / 100,
      subscriptionPlanCredits: planCredits,
      paygo: Math.floor(paygoBalance * 100) / 100,
    };
  }

  return NextResponse.json(
    { credits, subscription: subscription ?? null },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
