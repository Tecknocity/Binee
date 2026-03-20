import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select(
      'clickup_connected, clickup_team_id, clickup_team_name, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, clickup_plan_tier, clickup_last_webhook_at',
    )
    .eq('id', workspaceId)
    .single();

  if (error || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Check webhook health: consider healthy if:
  // 1. Last webhook event was within 24 hours, OR
  // 2. No events received yet but workspace was synced recently (just connected)
  let webhookHealthy = false;
  if (workspace.clickup_connected) {
    if (workspace.clickup_last_webhook_at) {
      const lastWebhook = new Date(workspace.clickup_last_webhook_at);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      webhookHealthy = lastWebhook > twentyFourHoursAgo;
    } else if (workspace.clickup_last_synced_at) {
      // No webhook events yet — healthy if workspace was synced within 24h (just connected)
      const lastSynced = new Date(workspace.clickup_last_synced_at);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      webhookHealthy = lastSynced > twentyFourHoursAgo;
    }
  }

  return NextResponse.json({
    connected: workspace.clickup_connected,
    team_id: workspace.clickup_team_id,
    team_name: workspace.clickup_team_name,
    sync_status: workspace.clickup_sync_status,
    last_synced_at: workspace.clickup_last_synced_at,
    sync_error: workspace.clickup_sync_error,
    plan_tier: workspace.clickup_plan_tier,
    webhook_healthy: webhookHealthy,
  });
}
