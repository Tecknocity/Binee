import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * POST /api/workspace/ensure-owner
 *
 * Ensures the authenticated user has a workspace and 'owner' role.
 * Handles three cases:
 * 1. User has workspace + member row → promotes role to 'owner' if needed
 * 2. User has workspace but no member row → creates member row as 'owner'
 * 3. User has no workspace at all → creates workspace + member row
 *
 * Uses service role key to bypass RLS (the first member insert can't pass
 * the "Admins can manage members" RLS policy since no member exists yet).
 */
export async function POST() {
  const cookieStore = await cookies();

  // Auth client — to identify the user from their session cookie
  const authClient = createServerClient(
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

  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service client — bypasses RLS for admin operations
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const userEmail = user.email ?? '';
  const displayName =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    userEmail.split('@')[0] ??
    'User';

  // Check if the user has any workspace_members rows (include all non-removed statuses)
  const { data: memberRows } = await admin
    .from('workspace_members')
    .select('id, workspace_id, role, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending']);

  // Check if the user owns any workspaces
  const { data: ownedWorkspaces } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id);

  // Also ensure the user has a profile row
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await admin.from('profiles').upsert({
      user_id: user.id,
      email: userEmail,
      full_name: displayName,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('ensure-owner: failed to create profile', {
        user_id: user.id,
        error: profileError.message,
      });
    }
  }

  const actions: string[] = [];

  // Case 3: No workspace at all — create one + member row
  if (!ownedWorkspaces || ownedWorkspaces.length === 0) {
    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'my-workspace';

    const { data: newWorkspace, error: wsError } = await admin
      .from('workspaces')
      .insert({
        name: `${displayName}'s Workspace`,
        slug: `${slug}-${Date.now().toString(36)}`,
        owner_id: user.id,
        plan: 'free',
        credit_balance: 10,
      })
      .select()
      .single();

    if (wsError || !newWorkspace) {
      return NextResponse.json(
        { error: 'Failed to create workspace', detail: wsError?.message },
        { status: 500 },
      );
    }

    const { error: memberError } = await admin.from('workspace_members').insert({
      workspace_id: newWorkspace.id,
      user_id: user.id,
      role: 'owner',
      email: userEmail,
      display_name: displayName,
      invited_email: userEmail,
      status: 'active',
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      console.error('ensure-owner: failed to create workspace_member, cleaning up orphaned workspace', {
        workspace_id: newWorkspace.id,
        user_id: user.id,
        error: memberError.message,
      });
      // Clean up orphaned workspace
      await admin.from('workspaces').delete().eq('id', newWorkspace.id);
      return NextResponse.json(
        { error: 'Failed to create workspace member', detail: memberError.message },
        { status: 500 },
      );
    }

    // Add welcome credits transaction
    const { error: creditError } = await admin.from('credit_transactions').insert({
      workspace_id: newWorkspace.id,
      user_id: user.id,
      amount: 10,
      balance_after: 10,
      type: 'bonus',
      description: 'Welcome to Binee! 10 free credits.',
    });

    if (creditError) {
      console.error('ensure-owner: failed to create credit transaction', {
        workspace_id: newWorkspace.id,
        error: creditError.message,
      });
      // Non-fatal: workspace and member exist, credits just won't show in history
    }

    actions.push('created_workspace', 'created_member');
    return NextResponse.json({ actions });
  }

  // Case 2: Has workspace(s) but no member rows — create missing member rows
  const ownedIds = ownedWorkspaces.map((w) => w.id);
  const memberWorkspaceIds = new Set((memberRows ?? []).map((m) => m.workspace_id));

  for (const wsId of ownedIds) {
    if (!memberWorkspaceIds.has(wsId)) {
      const { error: insertErr } = await admin.from('workspace_members').insert({
        workspace_id: wsId,
        user_id: user.id,
        role: 'owner',
        email: userEmail,
        display_name: displayName,
        invited_email: userEmail,
        status: 'active',
        joined_at: new Date().toISOString(),
      });
      if (insertErr) {
        console.error('ensure-owner: failed to backfill member row', {
          workspace_id: wsId,
          error: insertErr.message,
        });
      } else {
        actions.push(`created_member_for_${wsId}`);
      }
    }
  }

  // Case 1: Has workspace + member but role isn't 'owner' — promote
  const membersToPromote = (memberRows ?? []).filter(
    (m) => ownedIds.includes(m.workspace_id) && m.role !== 'owner',
  );

  for (const member of membersToPromote) {
    const { error: promoteErr } = await admin
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('id', member.id);
    if (promoteErr) {
      console.error('ensure-owner: failed to promote member', {
        member_id: member.id,
        error: promoteErr.message,
      });
    } else {
      actions.push(`promoted_${member.id}`);
    }
  }

  return NextResponse.json({ actions: actions.length > 0 ? actions : ['no_changes'] });
}
