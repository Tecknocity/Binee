import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { performInitialSync } from '@/lib/clickup/sync';
import { createServerClient } from '@/lib/supabase/server';


export async function POST(request: Request) {
  const body = await request.json();
  const { workspace_id } = body;

  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify user is owner/admin
  const authSupabase = await createServerClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { data: member } = await authSupabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Only workspace owners and admins can sync ClickUp' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Check that ClickUp is connected
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('clickup_connected, clickup_team_id')
    .eq('id', workspace_id)
    .single();

  if (!workspace?.clickup_connected || !workspace?.clickup_team_id) {
    return NextResponse.json({ error: 'ClickUp not connected' }, { status: 400 });
  }

  // Mark sync as in progress
  await supabase
    .from('workspaces')
    .update({
      clickup_sync_status: 'syncing',
      clickup_sync_error: null,
    })
    .eq('id', workspace_id);

  try {
    const result = await performInitialSync(workspace_id);

    // Mark sync as complete
    const now = new Date().toISOString();
    await supabase
      .from('workspaces')
      .update({
        clickup_sync_status: 'complete',
        clickup_last_synced_at: now,
        last_sync_at: now,
        clickup_sync_error: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .eq('id', workspace_id);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('workspaces')
      .update({
        clickup_sync_status: 'error',
        clickup_sync_error: message,
      })
      .eq('id', workspace_id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
