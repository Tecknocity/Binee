import { NextRequest, NextResponse } from 'next/server';
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
 * Auth: Accepts Authorization Bearer token (preferred — works right after signup)
 * or falls back to session cookies.
 *
 * Uses service role key to bypass RLS (the first member insert can't pass
 * the "Admins can manage members" RLS policy since no member exists yet).
 */
export async function POST(request: NextRequest) {
  // Validate env vars early
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ensure-owner: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!serviceRoleKey) {
    console.error('ensure-owner: SUPABASE_SERVICE_ROLE_KEY not set — cannot bypass RLS');
    return NextResponse.json({ error: 'Server misconfiguration: missing service role key' }, { status: 500 });
  }

  // --- Authenticate the user ---
  // Try Bearer token first (works immediately after signup, no cookie delay),
  // then fall back to session cookies.
  let user: { id: string; email?: string; user_metadata?: Record<string, string> } | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    } else {
      console.error('ensure-owner: Bearer token auth failed', error?.message);
    }
  }

  // Fallback: try cookies
  if (!user) {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    } else {
      console.error('ensure-owner: cookie auth failed', error?.message ?? 'no user');
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service client — bypasses RLS for admin operations
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const userEmail = user.email ?? '';
  const displayName =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    userEmail.split('@')[0] ??
    'User';

  console.log('ensure-owner: running for user', user.id, userEmail);

  // Check if the user has any workspace_members rows
  const { data: memberRows, error: memberQueryErr } = await admin
    .from('workspace_members')
    .select('id, workspace_id, role, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending']);

  if (memberQueryErr) {
    console.error('ensure-owner: failed to query workspace_members', memberQueryErr.message);
    // If workspace_members table doesn't exist, the column errors will show here.
    // Return 500 so the client-side fallback kicks in.
    if (memberQueryErr.message.includes('does not exist') || memberQueryErr.code === '42P01') {
      return NextResponse.json(
        { error: 'Database table missing. Please run migrations.', detail: memberQueryErr.message },
        { status: 500 },
      );
    }
  }

  // Check if the user owns any workspaces
  const { data: ownedWorkspaces, error: wsQueryErr } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id);

  if (wsQueryErr) {
    console.error('ensure-owner: failed to query workspaces', wsQueryErr.message);
    if (wsQueryErr.message.includes('does not exist') || wsQueryErr.code === '42P01') {
      return NextResponse.json(
        { error: 'Database table missing. Please run migrations.', detail: wsQueryErr.message },
        { status: 500 },
      );
    }
  }

  // Ensure the user has a profile row
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
    } else {
      console.log('ensure-owner: created profile for', user.id);
    }
  }

  const actions: string[] = [];

  // Case 3: No workspace at all — create one + member row
  if (!ownedWorkspaces || ownedWorkspaces.length === 0) {
    // If user has member rows for workspaces they don't own (invited),
    // don't create a new workspace — they're already part of one
    if (memberRows && memberRows.length > 0) {
      console.log('ensure-owner: user has member rows but no owned workspace, skipping creation');
      return NextResponse.json({ actions: ['has_memberships_no_owned_workspace'] });
    }

    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'my-workspace';

    console.log('ensure-owner: creating new workspace for', user.id);

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
      console.error('ensure-owner: failed to create workspace', wsError?.message);
      return NextResponse.json(
        { error: 'Failed to create workspace', detail: wsError?.message },
        { status: 500 },
      );
    }

    console.log('ensure-owner: created workspace', newWorkspace.id);

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
      await admin.from('workspaces').delete().eq('id', newWorkspace.id);
      return NextResponse.json(
        { error: 'Failed to create workspace member', detail: memberError.message },
        { status: 500 },
      );
    }

    console.log('ensure-owner: created workspace_member for', newWorkspace.id);

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
    }

    actions.push('created_workspace', 'created_member');
    console.log('ensure-owner: complete —', actions.join(', '));
    return NextResponse.json({ actions });
  }

  // Case 2: Has workspace(s) but no member rows — create missing member rows
  const ownedIds = ownedWorkspaces.map((w: { id: string }) => w.id);
  const memberWorkspaceIds = new Set((memberRows ?? []).map((m: { workspace_id: string }) => m.workspace_id));

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
    (m: { workspace_id: string; role: string }) => ownedIds.includes(m.workspace_id) && m.role !== 'owner',
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

  console.log('ensure-owner: complete —', actions.length > 0 ? actions.join(', ') : 'no_changes');
  return NextResponse.json({ actions: actions.length > 0 ? actions : ['no_changes'] });
}
