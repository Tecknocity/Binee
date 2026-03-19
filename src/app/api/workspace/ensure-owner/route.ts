import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/workspace/ensure-owner
 * Ensures the authenticated user has 'owner' role in workspaces they own.
 * Fixes the mismatch where the DB trigger creates members with 'admin' role
 * even when the user is the workspace owner (owner_id).
 */
export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only in route handlers
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find workspaces owned by this user where their member role is not 'owner'
  const { data: ownedWorkspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id);

  if (!ownedWorkspaces || ownedWorkspaces.length === 0) {
    return NextResponse.json({ promoted: 0 });
  }

  const workspaceIds = ownedWorkspaces.map((w) => w.id);

  // Promote the user to 'owner' role in all workspaces they own
  const { data: updated, error: updateError } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('user_id', user.id)
    .in('workspace_id', workspaceIds)
    .neq('role', 'owner')
    .select('id');

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }

  return NextResponse.json({ promoted: updated?.length ?? 0 });
}
