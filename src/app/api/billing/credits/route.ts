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
    .single();

  if (!member) {
    return NextResponse.json({ displayBalance: 0 });
  }

  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('credit_balance')
    .eq('id', member.workspace_id)
    .single();

  return NextResponse.json(
    { displayBalance: workspace?.credit_balance ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
