import { NextResponse } from 'next/server';
import { disconnectClickUp } from '@/lib/clickup/oauth';
import { unregisterWebhooks } from '@/lib/clickup/webhooks';
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

  try {
    // Unregister webhooks from ClickUp and clean up all stored records
    await unregisterWebhooks(workspace_id);

    // Clear tokens and disconnect
    await disconnectClickUp(workspace_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
