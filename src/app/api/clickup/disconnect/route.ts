import { NextResponse } from 'next/server';
import { disconnectClickUp } from '@/lib/clickup/oauth';
import { ClickUpClient } from '@/lib/clickup/client';
import { createClient } from '@supabase/supabase-js';
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
    return NextResponse.json({ error: 'Only workspace owners and admins can disconnect ClickUp' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // Get the workspace to find the webhook ID to delete
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('clickup_team_id, clickup_webhook_id')
      .eq('id', workspace_id)
      .single();

    // Try to delete the webhook from ClickUp
    if (workspace?.clickup_webhook_id) {
      try {
        const client = new ClickUpClient(workspace_id);
        await client.deleteWebhook(workspace.clickup_webhook_id);
      } catch {
        // Webhook deletion may fail if the token is already invalid
      }
    }

    // Delete webhook registrations from our DB
    await supabase
      .from('webhook_registrations')
      .delete()
      .eq('workspace_id', workspace_id);

    // Clear tokens and disconnect
    await disconnectClickUp(workspace_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
