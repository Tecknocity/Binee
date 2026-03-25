import { NextRequest, NextResponse } from 'next/server';
import { getSyncProgress } from '@/lib/clickup/sync';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify user belongs to this workspace
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
  }

  const progress = await getSyncProgress(workspaceId);
  return NextResponse.json(progress);
}
