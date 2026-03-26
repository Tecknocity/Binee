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
      .single(),
    supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single(),
  ]);

  const subscription = subscriptionResult.error ? null : subscriptionResult.data;

  let credits;
  if (!memberResult.data) {
    credits = { displayBalance: 0 };
  } else {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('credit_balance')
      .eq('id', memberResult.data.workspace_id)
      .single();

    credits = {
      displayBalance: workspace?.credit_balance ?? 0,
    };
  }

  return NextResponse.json(
    { credits, subscription: subscription ?? null },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
