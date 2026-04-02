import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { performInitialSync } from '@/lib/clickup/sync';
import { registerWebhooks } from '@/lib/clickup/webhooks';
import { createServerClient } from '@/lib/supabase/server';

// Allow up to 5 minutes for large workspace syncs (spaces, folders, lists,
// tasks, members, time entries). Without this, Vercel's default 10-60s timeout
// kills the function mid-sync, leaving the status permanently stuck at "syncing".
export const maxDuration = 300;

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
    .select('clickup_connected, clickup_team_id, clickup_sync_status, clickup_sync_started_at')
    .eq('id', workspace_id)
    .single();

  if (!workspace?.clickup_connected || !workspace?.clickup_team_id) {
    return NextResponse.json({ error: 'ClickUp not connected' }, { status: 400 });
  }

  // Prevent duplicate syncs — if already syncing and started < 10 min ago, reject
  if (workspace.clickup_sync_status === 'syncing' && workspace.clickup_sync_started_at) {
    const startedAt = new Date(workspace.clickup_sync_started_at).getTime();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (startedAt > tenMinutesAgo) {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
    }
    // If older than 10 min, it's stale — allow re-sync
  }

  // Mark sync as in progress with a timestamp so we can detect stale syncs
  await supabase
    .from('workspaces')
    .update({
      clickup_sync_status: 'syncing',
      clickup_sync_error: null,
      clickup_sync_started_at: new Date().toISOString(),
    })
    .eq('id', workspace_id);

  try {
    // Await the full sync — maxDuration=300 gives us up to 5 minutes.
    // The client doesn't block on this response; it polls /api/clickup/status instead.
    console.log(`[ClickUp Sync] Starting sync for workspace ${workspace_id}`);
    const result = await performInitialSync(workspace_id);

    // Re-register webhooks to fix unhealthy state (non-fatal if it fails)
    try {
      console.log(`[ClickUp Sync] Re-registering webhooks for workspace ${workspace_id}`);
      await registerWebhooks(workspace_id, workspace.clickup_team_id);
      console.log(`[ClickUp Sync] Webhooks re-registered successfully`);
    } catch (webhookError) {
      console.error(`[ClickUp Sync] Webhook re-registration failed (non-fatal):`, webhookError);
    }

    // Mark sync as complete (performInitialSync throws on fatal errors,
    // so reaching here means the sync succeeded, possibly with non-fatal errors)
    const now = new Date().toISOString();
    console.log(`[ClickUp Sync] Completed: ${result.spaces} spaces, ${result.tasks} tasks, ${result.errors.length} errors`);
    await supabase
      .from('workspaces')
      .update({
        clickup_sync_status: 'complete',
        clickup_last_synced_at: now,
        last_sync_at: now,
        clickup_sync_started_at: null,
        clickup_sync_error: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .eq('id', workspace_id);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ClickUp Sync] Failed for workspace ${workspace_id}:`, message);
    await supabase
      .from('workspaces')
      .update({
        clickup_sync_status: 'error',
        clickup_sync_error: message,
        clickup_sync_started_at: null,
      })
      .eq('id', workspace_id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
