import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLAN_TIERS, type PlanTier } from '@/billing/config';

// Vercel Cron: runs on the 1st of each month at midnight UTC
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all workspaces that need subscription credit reset
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, plan, credit_balance, subscription_balance, paygo_balance, owner_id');

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ message: 'No workspaces', reset: 0 });
  }

  let reset = 0;

  for (const ws of workspaces) {
    const tierConfig = PLAN_TIERS[ws.plan as PlanTier];
    if (!tierConfig) continue; // Skip workspaces without a subscription tier
    const monthlyCredits = tierConfig.credits;

    // Reset subscription pool only; paygo pool is untouched
    await supabase.rpc('reset_subscription_credits', {
      p_workspace_id: ws.id,
      p_user_id: ws.owner_id,
      p_amount: monthlyCredits,
      p_description: `Monthly credit reset for ${ws.plan} plan`,
      p_metadata: {
        plan: ws.plan,
        previous_subscription_balance: ws.subscription_balance,
      },
    });

    reset++;
  }

  return NextResponse.json({ reset });
}
