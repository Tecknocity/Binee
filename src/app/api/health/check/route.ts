import { NextResponse } from 'next/server';
import { runHealthCheck } from '@/lib/health/checker';
import { computeWorkspaceMetrics } from '@/lib/health/metrics';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace_id } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify user is authenticated and has access to this workspace
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    // Compute metrics once, then pass to runHealthCheck to avoid duplicate RPC call
    const metrics = await computeWorkspaceMetrics(workspace_id);
    const result = await runHealthCheck(workspace_id, metrics);

    return NextResponse.json({ result, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
