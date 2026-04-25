import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

/**
 * GET /api/setup/enrichment-status?workspace_id=xxx[&build_id=yyy]
 *
 * Returns the current state of the most recent build for this workspace,
 * including per-job status. Used by the frontend poll.
 *
 * Response shape:
 * {
 *   build: {
 *     id, status, started_at, completed_at, estimated_completion_at,
 *     total_jobs, structural_result, plan
 *   } | null,
 *   jobs: Array<{ id, type, target_name, parent_name, status, attempts, last_error, result }>,
 *   summary: { pending, in_progress, done, failed }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    const buildIdParam = request.nextUrl.searchParams.get('build_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let buildQuery = adminClient
      .from('setup_builds')
      .select('id, status, started_at, completed_at, estimated_completion_at, total_jobs, structural_result, plan')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(1);

    if (buildIdParam) {
      buildQuery = adminClient
        .from('setup_builds')
        .select('id, status, started_at, completed_at, estimated_completion_at, total_jobs, structural_result, plan')
        .eq('id', buildIdParam)
        .eq('workspace_id', workspaceId);
    }

    const { data: builds, error: buildErr } = await buildQuery;

    if (buildErr) {
      return NextResponse.json({ error: buildErr.message }, { status: 500 });
    }

    const build = builds?.[0] ?? null;
    if (!build) {
      return NextResponse.json({ build: null, jobs: [], summary: { pending: 0, in_progress: 0, done: 0, failed: 0 } });
    }

    const { data: jobs } = await adminClient
      .from('setup_enrichment_jobs')
      .select('id, type, target_name, parent_name, status, attempts, last_error, result')
      .eq('build_id', build.id)
      .order('created_at', { ascending: true });

    const jobList = jobs ?? [];
    const summary = jobList.reduce(
      (acc: Record<string, number>, j: { status: string }) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1;
        return acc;
      },
      { pending: 0, in_progress: 0, done: 0, failed: 0 },
    );

    return NextResponse.json({ build, jobs: jobList, summary });
  } catch (err) {
    console.error('[enrichment-status] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
