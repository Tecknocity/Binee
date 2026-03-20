import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/debug
 *
 * Diagnostic endpoint that checks:
 * 1. Whether the user is authenticated
 * 2. Whether the database tables exist
 * 3. Whether the user has a profile, workspace, and member row
 * 4. Whether the handle_new_user trigger exists
 * 5. Whether the service role key is configured
 *
 * Returns a detailed report for debugging signup/signin issues.
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? 'set' : 'MISSING',
    },
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    report.error = 'Supabase env vars not configured';
    return NextResponse.json(report, { status: 500 });
  }

  // Authenticate the user
  let userId: string | null = null;
  let userEmail: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    if (!error && data?.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    }
  }

  if (!userId) {
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only */ },
      },
    });
    const { data } = await authClient.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    }
  }

  report.auth = {
    authenticated: !!userId,
    user_id: userId,
    email: userEmail,
  };

  if (!userId) {
    report.error = 'Not authenticated — sign in first, then visit this endpoint.';
    return NextResponse.json(report, { status: 401 });
  }

  if (!serviceRoleKey) {
    report.error = 'SUPABASE_SERVICE_ROLE_KEY not set — ensure-owner API cannot function.';
    return NextResponse.json(report, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Check tables exist
  const tables = ['profiles', 'workspaces', 'workspace_members', 'credit_transactions'];
  const tableChecks: Record<string, string> = {};
  for (const table of tables) {
    const { error } = await admin.from(table).select('id').limit(0);
    tableChecks[table] = error ? `ERROR: ${error.message}` : 'exists';
  }
  report.tables = tableChecks;

  // Note: Cannot directly check if trigger exists via Supabase client.
  // The handle_new_user() trigger is verified indirectly by checking
  // if profile/workspace rows were created automatically on signup.
  report.trigger_note = 'Trigger existence is inferred from user data below. If profile/workspace are missing, the trigger likely does not exist.';

  // Check user's data
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, user_id, email, full_name')
    .eq('user_id', userId)
    .maybeSingle();

  report.profile = profileErr
    ? { error: profileErr.message }
    : profile
      ? { exists: true, ...profile }
      : { exists: false };

  const { data: ownedWs, error: wsErr } = await admin
    .from('workspaces')
    .select('id, name, slug, plan, credit_balance')
    .eq('owner_id', userId);

  report.owned_workspaces = wsErr
    ? { error: wsErr.message }
    : { count: ownedWs?.length ?? 0, workspaces: ownedWs };

  const { data: memberRows, error: memberErr } = await admin
    .from('workspace_members')
    .select('id, workspace_id, role, status, email, display_name')
    .eq('user_id', userId);

  report.workspace_members = memberErr
    ? { error: memberErr.message }
    : { count: memberRows?.length ?? 0, members: memberRows };

  const { data: creditRows, error: creditErr } = await admin
    .from('credit_transactions')
    .select('id, workspace_id, amount, type, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  report.credit_transactions = creditErr
    ? { error: creditErr.message }
    : { count: creditRows?.length ?? 0, recent: creditRows };

  // Summary
  const hasProfile = !!(profile && !profileErr);
  const hasWorkspace = !!(ownedWs && ownedWs.length > 0 && !wsErr);
  const hasMember = !!(memberRows && memberRows.length > 0 && !memberErr);

  report.summary = {
    all_ok: hasProfile && hasWorkspace && hasMember,
    has_profile: hasProfile,
    has_workspace: hasWorkspace,
    has_member_row: hasMember,
    diagnosis: !hasProfile && !hasWorkspace && !hasMember
      ? 'TRIGGER_NOT_FIRING: The handle_new_user() trigger is not creating any records. Run migration 010_fix_signup_trigger_and_schema.sql in your Supabase SQL Editor.'
      : !hasWorkspace && !hasMember
        ? 'MISSING_WORKSPACE: Profile exists but no workspace. The trigger partially ran. Run migration 010 to fix.'
        : hasWorkspace && !hasMember
          ? 'MISSING_MEMBER_ROW: Workspace exists but no member row. RLS will block all queries. Run migration 010 to fix.'
          : hasProfile && hasWorkspace && hasMember
            ? 'All good — user data is complete.'
            : 'Partial data found. Run migration 010 to fix.',
  };

  return NextResponse.json(report);
}
