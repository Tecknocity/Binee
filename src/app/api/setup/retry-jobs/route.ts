import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

/**
 * POST /api/setup/retry-jobs
 *
 * Resets failed jobs back to 'pending' so the worker picks them up again.
 *
 * Body modes:
 *   { build_id, job_ids: [...] }    -> retry exactly these jobs
 *   { build_id, all_failed: true }  -> retry every failed job in the build
 *
 * After updating rows, kicks the worker so the user sees progress immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { build_id, job_ids, all_failed } = body as {
      build_id: string;
      job_ids?: string[];
      all_failed?: boolean;
    };

    if (!build_id) {
      return NextResponse.json({ error: 'Missing build_id' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Verify build exists and user is a member of its workspace.
    const { data: build } = await adminClient
      .from('setup_builds')
      .select('id, workspace_id, status')
      .eq('id', build_id)
      .single();

    if (!build) {
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', build.workspace_id)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    let updateQuery = adminClient
      .from('setup_enrichment_jobs')
      .update({
        status: 'pending',
        attempts: 0,
        last_error: null,
        locked_at: null,
        locked_by: null,
      })
      .eq('build_id', build_id)
      .eq('status', 'failed');

    if (Array.isArray(job_ids) && job_ids.length > 0) {
      updateQuery = updateQuery.in('id', job_ids);
    } else if (!all_failed) {
      return NextResponse.json({ error: 'Provide job_ids[] or all_failed:true' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await updateQuery.select('id');
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const retriedCount = updated?.length ?? 0;

    // Reopen the build if it was already marked completed.
    if (retriedCount > 0 && build.status !== 'enriching') {
      await adminClient
        .from('setup_builds')
        .update({ status: 'enriching', completed_at: null })
        .eq('id', build_id);
    }

    // Kick the worker so the user gets progress without waiting for cron.
    const baseUrl = new URL(request.url).origin;
    fetch(`${baseUrl}/api/setup/run-enrichment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': process.env.INTERNAL_TRIGGER_SECRET ?? '',
      },
      body: JSON.stringify({ workspace_id: build.workspace_id }),
    }).catch(() => undefined);

    return NextResponse.json({ retried: retriedCount });
  } catch (err) {
    console.error('[retry-jobs] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
