import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs on the 1st of each month at midnight UTC
export const dynamic = 'force-dynamic';

const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 200,
  pro: 600,
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all workspaces that need credit reset
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, plan, credit_balance, owner_id');

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ message: 'No workspaces', reset: 0 });
  }

  let reset = 0;

  for (const ws of workspaces) {
    const monthlyCredits = PLAN_CREDITS[ws.plan] ?? 10;

    // Reset credit balance to plan amount
    await supabase
      .from('workspaces')
      .update({
        credit_balance: monthlyCredits,
        credits_reset_at: new Date().toISOString(),
      })
      .eq('id', ws.id);

    // Record the reset transaction
    await supabase.from('credit_transactions').insert({
      workspace_id: ws.id,
      user_id: ws.owner_id,
      amount: monthlyCredits - ws.credit_balance,
      balance_after: monthlyCredits,
      type: 'monthly_reset',
      description: `Monthly credit reset for ${ws.plan} plan`,
      metadata: { previous_balance: ws.credit_balance },
    });

    reset++;
  }

  return NextResponse.json({ reset });
}
