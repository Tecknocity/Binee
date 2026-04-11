import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/billing/credits
 *
 * Returns the workspace credit balance for the authenticated user.
 * All team members see the same balance — credits are workspace-scoped.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find the user's workspace via membership
  const { data: member } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .limit(1)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({
      displayBalance: 0,
      subscription: 0,
      subscriptionPlanCredits: 0,
      paygo: 0,
    });
  }

  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('credit_balance, subscription_balance, paygo_balance')
    .eq('id', member.workspace_id)
    .single();

  const subBalance = workspace?.subscription_balance ?? 0;
  const paygoBalance = workspace?.paygo_balance ?? 0;
  const totalBalance = workspace?.credit_balance ?? (subBalance + paygoBalance);

  return NextResponse.json(
    {
      displayBalance: Math.floor(totalBalance),
      subscription: Math.floor(subBalance * 100) / 100,
      subscriptionPlanCredits: 0,
      paygo: Math.floor(paygoBalance * 100) / 100,
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
