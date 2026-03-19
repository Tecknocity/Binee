import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * POST /api/workspace/ensure-owner
 *
 * Ensures the authenticated user has:
 * 1. A `profiles` row (auth-synced profile)
 * 2. A `user_profiles` row (settings/preferences)
 * 3. A workspace they own
 * 4. A `workspace_members` row linking them as 'owner'
 * 5. A welcome credit transaction
 *
 * Uses service role key to bypass RLS.
 * Designed to be idempotent — safe to call multiple times.
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
  const avatarUrl = user.user_metadata?.avatar_url ?? null;

  const actions: string[] = [];

  // ── Step 1: Ensure profiles row exists ────────────────────────
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
      avatar_url: avatarUrl,
    }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('[ensure-owner] Failed to create profiles row:', profileError.message);
    } else {
      actions.push('created_profile');
    }
  }

  // ── Step 2: Ensure user_profiles row exists ───────────────────
  const { data: existingUserProfile } = await admin
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingUserProfile) {
    const { error: upError } = await admin.from('user_profiles').upsert({
      user_id: user.id,
    }, { onConflict: 'user_id' });

    if (upError) {
      console.error('[ensure-owner] Failed to create user_profiles row:', upError.message);
    } else {
      actions.push('created_user_profile');
    }
  }

  // ── Step 3: Check existing workspace ownership & membership ───
  const { data: ownedWorkspaces } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id);

  const { data: memberRows } = await admin
    .from('workspace_members')
    .select('id, workspace_id, role, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending']);

  // ── Step 4: Create workspace if user owns none ────────────────
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
      console.error('[ensure-owner] Failed to create workspace:', wsError?.message);
      return NextResponse.json(
        { error: 'Failed to create workspace', detail: wsError?.message },
        { status: 500 },
      );
    }

    // Create workspace_members row
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
      console.error('[ensure-owner] Failed to create workspace_members row:', memberError.message);
      // Critical failure — try to clean up the orphaned workspace
      await admin.from('workspaces').delete().eq('id', newWorkspace.id);
      return NextResponse.json(
        { error: 'Failed to create membership', detail: memberError.message },
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
      console.error('[ensure-owner] Failed to create credit transaction:', creditError.message);
      // Non-critical — workspace and membership are created
    }

    actions.push('created_workspace', 'created_member', 'created_credits');
    return NextResponse.json({ actions });
  }

  // ── Step 5: Has workspace(s) — ensure member rows exist ───────
  const ownedIds = ownedWorkspaces.map((w) => w.id);
  const memberWorkspaceIds = new Set((memberRows ?? []).map((m) => m.workspace_id));

  for (const wsId of ownedIds) {
    if (!memberWorkspaceIds.has(wsId)) {
      const { error: memberError } = await admin.from('workspace_members').insert({
        workspace_id: wsId,
        user_id: user.id,
        role: 'owner',
        email: userEmail,
        display_name: displayName,
        invited_email: userEmail,
        status: 'active',
        joined_at: new Date().toISOString(),
      });

      if (memberError) {
        console.error(`[ensure-owner] Failed to create member row for workspace ${wsId}:`, memberError.message);
      } else {
        actions.push(`created_member_for_${wsId}`);
      }
    }
  }

  // ── Step 6: Ensure owned workspace members have 'owner' role ──
  const membersToPromote = (memberRows ?? []).filter(
    (m) => ownedIds.includes(m.workspace_id) && m.role !== 'owner',
  );

  for (const member of membersToPromote) {
    const { error: promoteError } = await admin
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('id', member.id);

    if (promoteError) {
      console.error(`[ensure-owner] Failed to promote member ${member.id}:`, promoteError.message);
    } else {
      actions.push(`promoted_${member.id}`);
    }
  }

  return NextResponse.json({ actions: actions.length > 0 ? actions : ['no_changes'] });
}
