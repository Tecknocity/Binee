import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * POST /api/workspace/load
 *
 * Loads the authenticated user's workspaces using the service role key,
 * bypassing RLS entirely. This is a safety net for when browser-side
 * Supabase queries fail due to RLS policy issues (e.g. infinite recursion
 * from self-referencing policies on workspace_members).
 *
 * Returns: { workspaces: [...], members: [...] }
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Missing service role key' }, { status: 500 });
  }

  // --- Authenticate the user ---
  let userId: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    if (!error && data?.user) {
      userId = data.user.id;
    }
  }

  if (!userId) {
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) {
      userId = data.user.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service client — bypasses RLS
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Load workspace_members for this user.
  // Try with status filter first; if the status column doesn't exist, retry without it.
  // Also try querying by owner_id on workspaces as a final fallback.
  type MemberRow = { workspace_id: string; role: string; email: string; display_name: string | null; avatar_url: string | null; status?: string };
  let memberRows: MemberRow[] = [];

  const { data: statusRows, error: statusErr } = await admin
    .from('workspace_members')
    .select('workspace_id, role, email, display_name, avatar_url, status')
    .eq('user_id', userId)
    .in('status', ['active', 'pending']);

  if (statusErr) {
    // Status column likely doesn't exist — retry without it
    console.warn('workspace/load: status column query failed, retrying without status filter');
    const { data: fallbackRows, error: fallbackErr } = await admin
      .from('workspace_members')
      .select('workspace_id, role, email, display_name, avatar_url')
      .eq('user_id', userId);

    if (fallbackErr) {
      console.error('workspace/load: fallback query also failed', fallbackErr.message);
      return NextResponse.json({ error: 'Failed to load members', detail: fallbackErr.message }, { status: 500 });
    }
    memberRows = (fallbackRows ?? []).map((m) => ({ ...m, status: 'active' as const }));
  } else {
    memberRows = statusRows ?? [];
  }

  // If no member rows found, also check if user owns any workspaces directly
  // (member row may be missing even though workspace exists)
  if (memberRows.length === 0) {
    const { data: ownedWs } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId);

    if (ownedWs && ownedWs.length > 0) {
      // User owns workspaces but has no member rows — return the workspaces anyway
      const wsIds = ownedWs.map((w) => w.id);
      const { data: workspaces } = await admin.from('workspaces').select('*').in('id', wsIds);

      // Synthesize member data from workspace ownership
      const syntheticMembers = (workspaces ?? []).map((ws) => ({
        workspace_id: ws.id,
        role: 'owner',
        email: '',
        display_name: null,
        avatar_url: null,
        status: 'active',
      }));

      return NextResponse.json({
        workspaces: workspaces ?? [],
        members: syntheticMembers,
      });
    }

    return NextResponse.json({ workspaces: [], members: [] });
  }

  const wsIds = memberRows.map((m) => m.workspace_id);
  const { data: workspaces, error: wsErr } = await admin.from('workspaces').select('*').in('id', wsIds);

  if (wsErr) {
    return NextResponse.json({ error: 'Failed to load workspaces', detail: wsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    workspaces: workspaces ?? [],
    members: memberRows,
  });
}
