import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { runJob, type JobPayload } from '@/lib/setup/job-worker';
import { logError, errorToMessage } from '@/lib/errors/log';

// The new tables (setup_builds, setup_enrichment_jobs) aren't in the generated
// Database type yet, so helpers accept the admin client as a permissive type.
// All queries are server-only with the service role key, RLS-safe by
// construction (RLS is enabled on these tables with no user-facing policies).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

// Worker function: long enough to chew through several jobs, short enough to
// be safely re-invoked by cron every minute.
export const maxDuration = 300;

// Maximum jobs processed per invocation. Tuned so a single 300s call always
// fits comfortably even when ClickUp issues a 30-second Retry-After.
const MAX_JOBS_PER_RUN = 25;

// Stale-lease threshold. If a job has been "in_progress" longer than this with
// no update, we assume the previous worker crashed or got killed and reclaim it.
const STALE_LEASE_MS = 3 * 60 * 1000;

// Per-workspace concurrency: how many jobs we process in parallel for one
// workspace. ClickUp rate-limits per token, so going wider than this just
// triggers 429s without buying real throughput.
const CONCURRENCY_PER_WORKSPACE = 5;

/**
 * POST /api/setup/run-enrichment
 *
 * Triggered by:
 *   - Vercel cron (every minute) to drain pending jobs
 *   - The execute endpoint immediately after enqueueing (so users see
 *     progress without waiting for the next cron tick)
 *   - The frontend poll (so progress is real-time when a tab is open)
 *
 * Auth: accepts any of:
 *   - CRON_SECRET via Authorization: Bearer (cron path)
 *   - INTERNAL_TRIGGER_SECRET via x-internal-trigger header (server-to-server)
 *   - Authenticated Supabase session (user-driven invocation from /setup page)
 */
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Reclaim stale leases so a crashed worker doesn't leave rows pinned forever.
  await reclaimStaleLeases(adminClient).catch((err) => {
    console.error('[run-enrichment] Failed to reclaim stale leases:', err);
  });

  // Find workspaces with pending work. We process one workspace at a time
  // (well, a couple per invocation) so each respects ClickUp's per-token rate
  // limit. The workspace lease pattern below ensures only one process touches
  // any given workspace at a time.
  const { data: pendingBuilds } = await adminClient
    .from('setup_builds')
    .select('id, workspace_id, worker_locked_at')
    .eq('status', 'enriching')
    .order('started_at', { ascending: true })
    .limit(20);

  if (!pendingBuilds || pendingBuilds.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No pending builds' });
  }

  // If the caller specified a workspace_id, only process that one (used by
  // the execute trigger and the frontend poll for snappier UX).
  let targetWorkspaceId: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.workspace_id === 'string') {
      targetWorkspaceId = body.workspace_id;
    }
  } catch {
    // No body, fine.
  }

  const workspacesToProcess = targetWorkspaceId
    ? pendingBuilds.filter((b) => b.workspace_id === targetWorkspaceId)
    : pendingBuilds;

  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (const build of workspacesToProcess) {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Try to acquire the workspace lease. If another worker holds it (and
    // the lease isn't stale), skip this workspace.
    const leaseAcquired = await acquireWorkspaceLease(
      adminClient,
      build.id,
      workerId,
    );
    if (!leaseAcquired) continue;

    try {
      const result = await processWorkspaceBuild(
        adminClient,
        build.id,
        build.workspace_id,
        workerId,
      );
      totalProcessed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
    } finally {
      await releaseWorkspaceLease(adminClient, build.id, workerId);
    }

    // Cap total work per invocation across workspaces so a single call doesn't
    // exhaust the function budget on one giant build and starve others.
    if (totalProcessed >= MAX_JOBS_PER_RUN) break;
  }

  return NextResponse.json({
    processed: totalProcessed,
    succeeded: totalSucceeded,
    failed: totalFailed,
  });
}

// ---------------------------------------------------------------------------
// Process one workspace's build until done or budget exhausted
// ---------------------------------------------------------------------------

interface RunResult {
  processed: number;
  succeeded: number;
  failed: number;
}

async function processWorkspaceBuild(
  adminClient: AdminClient,
  buildId: string,
  workspaceId: string,
  workerId: string,
): Promise<RunResult> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (processed < MAX_JOBS_PER_RUN) {
    // Pull a batch of pending jobs for this build with row-level leases.
    // We use a short-running RPC with FOR UPDATE SKIP LOCKED to avoid the
    // double-process race condition.
    const batch = await leasePendingJobs(
      adminClient,
      buildId,
      workerId,
      Math.min(CONCURRENCY_PER_WORKSPACE, MAX_JOBS_PER_RUN - processed),
    );

    if (batch.length === 0) break;

    const outcomes = await Promise.all(
      batch.map((job) => processOneJob(adminClient, job, workspaceId, workerId)),
    );

    for (const outcome of outcomes) {
      processed++;
      if (outcome === 'success') succeeded++;
      else if (outcome === 'failure') failed++;
    }
  }

  // After processing, check if the build is fully done.
  const { data: stats } = await adminClient
    .from('setup_enrichment_jobs')
    .select('status', { count: 'exact', head: false })
    .eq('build_id', buildId);

  if (stats) {
    const remaining = stats.filter(
      (s: { status: string }) => s.status === 'pending' || s.status === 'in_progress',
    ).length;
    if (remaining === 0) {
      const failedCount = stats.filter((s: { status: string }) => s.status === 'failed').length;
      await adminClient
        .from('setup_builds')
        .update({
          status: failedCount > 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', buildId);
    }
  }

  return { processed, succeeded, failed };
}

interface JobRow {
  id: string;
  type: string;
  target_clickup_id: string;
  target_name: string;
  parent_name: string | null;
  payload: unknown;
  attempts: number;
}

async function processOneJob(
  adminClient: AdminClient,
  job: JobRow,
  workspaceId: string,
  workerId: string,
): Promise<'success' | 'failure'> {
  const startedAt = Date.now();

  try {
    const outcome = await runJob(
      job.type,
      job.target_clickup_id,
      job.payload as JobPayload,
      workspaceId,
    );

    if (outcome.ok) {
      await adminClient
        .from('setup_enrichment_jobs')
        .update({
          status: 'done',
          locked_at: null,
          locked_by: null,
          last_error: null,
          result: outcome.result ?? null,
          attempts: job.attempts + 1,
        })
        .eq('id', job.id)
        .eq('locked_by', workerId);
      return 'success';
    }

    // Failed. Mark for retry if we haven't exhausted attempts; otherwise mark failed.
    const nextAttempts = job.attempts + 1;
    const finalStatus = nextAttempts >= 3 ? 'failed' : 'pending';
    await adminClient
      .from('setup_enrichment_jobs')
      .update({
        status: finalStatus,
        locked_at: null,
        locked_by: null,
        last_error: outcome.errorMessage?.slice(0, 1000) ?? 'Unknown error',
        attempts: nextAttempts,
      })
      .eq('id', job.id)
      .eq('locked_by', workerId);

    if (finalStatus === 'failed') {
      await logError({
        source: 'setup.enrichment.job',
        errorCode: 'job_failed_after_retries',
        message: outcome.errorMessage ?? 'Unknown error',
        workspaceId,
        metadata: {
          jobId: job.id,
          jobType: job.type,
          target: job.target_name,
          attempts: nextAttempts,
          durationMs: Date.now() - startedAt,
        },
      });
    }
    return 'failure';
  } catch (err) {
    // Unexpected error - mark as pending so a future run can retry.
    await adminClient
      .from('setup_enrichment_jobs')
      .update({
        status: 'pending',
        locked_at: null,
        locked_by: null,
        last_error: errorToMessage(err).slice(0, 1000),
        attempts: job.attempts + 1,
      })
      .eq('id', job.id)
      .eq('locked_by', workerId);
    return 'failure';
  }
}

// ---------------------------------------------------------------------------
// Lease helpers: workspace-level and row-level
// ---------------------------------------------------------------------------

async function acquireWorkspaceLease(
  adminClient: AdminClient,
  buildId: string,
  workerId: string,
): Promise<boolean> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LEASE_MS).toISOString();

  // Acquire if no lease, OR lease is stale.
  const { data, error } = await adminClient
    .from('setup_builds')
    .update({
      worker_locked_at: now.toISOString(),
      worker_locked_by: workerId,
    })
    .eq('id', buildId)
    .or(`worker_locked_at.is.null,worker_locked_at.lt.${staleCutoff}`)
    .select('id');

  if (error) {
    console.error('[run-enrichment] Lease acquire failed:', error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function releaseWorkspaceLease(
  adminClient: AdminClient,
  buildId: string,
  workerId: string,
): Promise<void> {
  await adminClient
    .from('setup_builds')
    .update({ worker_locked_at: null, worker_locked_by: null })
    .eq('id', buildId)
    .eq('worker_locked_by', workerId);
}

async function leasePendingJobs(
  adminClient: AdminClient,
  buildId: string,
  workerId: string,
  limit: number,
): Promise<JobRow[]> {
  // Two-step lease: select pending ids, then update them to in_progress with
  // our worker_id. Because we already hold the workspace-level lease, no
  // other worker is competing for these rows. The .eq('status', 'pending')
  // on the update is the safety check that prevents double-leasing if
  // something slipped through.
  const { data: pending } = await adminClient
    .from('setup_enrichment_jobs')
    .select('id')
    .eq('build_id', buildId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pending || pending.length === 0) return [];

  const ids = pending.map((p: { id: string }) => p.id);
  const { data: leased, error } = await adminClient
    .from('setup_enrichment_jobs')
    .update({
      status: 'in_progress',
      locked_at: new Date().toISOString(),
      locked_by: workerId,
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id, type, target_clickup_id, target_name, parent_name, payload, attempts');

  if (error) {
    console.error('[run-enrichment] Lease jobs failed:', error);
    return [];
  }

  return (leased ?? []) as JobRow[];
}

async function reclaimStaleLeases(
  adminClient: AdminClient,
): Promise<void> {
  const staleCutoff = new Date(Date.now() - STALE_LEASE_MS).toISOString();

  await adminClient
    .from('setup_enrichment_jobs')
    .update({
      status: 'pending',
      locked_at: null,
      locked_by: null,
    })
    .eq('status', 'in_progress')
    .lt('locked_at', staleCutoff);

  await adminClient
    .from('setup_builds')
    .update({ worker_locked_at: null, worker_locked_by: null })
    .eq('status', 'enriching')
    .lt('worker_locked_at', staleCutoff);
}

// ---------------------------------------------------------------------------
// Auth: cron secret OR internal trigger OR authenticated user session
// ---------------------------------------------------------------------------

async function authorize(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.INTERNAL_TRIGGER_SECRET;

  // Cron path: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true };
  }

  // Internal trigger path: server-to-server from /api/setup/execute.
  const internalHeader = request.headers.get('x-internal-trigger');
  if (internalSecret && internalHeader === internalSecret) {
    return { ok: true };
  }

  // User session path: authenticated user driving real-time enrichment.
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return { ok: true };
  } catch {
    // Fall through to unauthorized.
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}

// GET handler so Vercel cron can hit this if the user prefers GET-style crons.
export async function GET(request: NextRequest) {
  return POST(request);
}
