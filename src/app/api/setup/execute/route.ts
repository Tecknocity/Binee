import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { executeSetupPlan, type ExecutionItem } from '@/lib/setup/executor';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';
import { getExistingStructure } from '@/lib/setup/snapshots';
import { estimateBuildTime } from '@/lib/setup/eta';
import type { SetupPlan } from '@/lib/setup/types';
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';

// Structural creation fits well inside this. Enrichment is a separate
// long-running job processed by /api/setup/run-enrichment.
export const maxDuration = 60;

/**
 * POST /api/setup/execute
 *
 * Synchronous part of the build: creates spaces/folders/lists/tags/doc-shells/
 * goals in ClickUp, then enqueues per-list and per-doc enrichment jobs into
 * setup_enrichment_jobs. Returns immediately with a build_id and ETA so the
 * frontend can show progress and the user can leave the page.
 *
 * Body: { workspace_id, plan, existing_structure?, generate_enrichment? }
 * Response: {
 *   build_id, started_at, estimated_completion_at, eta_minutes,
 *   structural_result, total_jobs
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, plan, existing_structure, generate_enrichment } = body as {
      workspace_id: string;
      plan: SetupPlan;
      existing_structure?: ExistingWorkspaceStructure | null;
      generate_enrichment?: boolean;
    };

    if (!workspace_id || !plan) {
      return NextResponse.json({ error: 'Missing workspace_id or plan' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', authUser.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: workspaceRow } = await adminClient
      .from('workspaces')
      .select('clickup_plan_tier')
      .eq('id', workspace_id)
      .single();
    const planTier = workspaceRow?.clickup_plan_tier || 'free';

    // Refresh ClickUp cache and rebuild existing_structure server-side so the
    // executor operates on current reality. Falls back to client-supplied
    // structure if the sync fails.
    let resolvedStructure: ExistingWorkspaceStructure | null | undefined = existing_structure;
    try {
      await syncWorkspaceStructure(workspace_id);
      const fresh = await getExistingStructure(workspace_id);
      if (fresh) {
        resolvedStructure = fresh as ExistingWorkspaceStructure;
      }
    } catch (syncErr) {
      console.error('[setup/execute] Pre-build sync failed, using client-supplied structure:', syncErr);
    }

    // Structural creation only. Enrichment runs out-of-band via the queue.
    let structuralResult;
    try {
      structuralResult = await executeSetupPlan(
        plan,
        workspace_id,
        '',
        undefined,
        resolvedStructure,
        planTier,
        { generateEnrichment: false, userId: authUser.id },
      );
    } catch (execErr) {
      console.error('[setup/execute] Structural executor threw:', execErr);
      const errorMessage = execErr instanceof Error ? execErr.message : 'Execution failed unexpectedly';
      return NextResponse.json({
        error: errorMessage,
        structural_result: {
          success: false,
          totalItems: 0,
          successCount: 0,
          errorCount: 1,
          items: [],
          createdSpaceIds: [],
          createdFolderIds: [],
          createdListIds: [],
          executorError: errorMessage,
        },
      }, { status: 500 });
    }

    // Skip enqueue entirely if the user opted out of enrichment.
    if (generate_enrichment === false) {
      return NextResponse.json({
        build_id: null,
        started_at: new Date().toISOString(),
        estimated_completion_at: null,
        eta_minutes: 0,
        structural_result: structuralResult,
        total_jobs: 0,
      });
    }

    // Compute ETA and create the parent build row.
    const eta = estimateBuildTime({ plan });
    const startedAt = new Date().toISOString();

    const { data: buildRow, error: buildErr } = await adminClient
      .from('setup_builds')
      .insert({
        workspace_id,
        status: 'enriching',
        started_at: startedAt,
        estimated_completion_at: eta.completionAtIso,
        plan,
        structural_result: structuralResult,
        created_by: authUser.id,
      })
      .select('id')
      .single();

    if (buildErr || !buildRow) {
      console.error('[setup/execute] Failed to create setup_builds row:', buildErr);
      return NextResponse.json({
        error: 'Failed to register build',
        structural_result: structuralResult,
      }, { status: 500 });
    }

    const buildId = buildRow.id as string;

    // Build the list of enrichment jobs from the plan + structural result.
    const jobs = buildEnrichmentJobs({
      buildId,
      workspaceId: workspace_id,
      plan,
      structuralResult,
      planTier,
    });

    if (jobs.length > 0) {
      const { error: insertErr } = await adminClient
        .from('setup_enrichment_jobs')
        .insert(jobs);

      if (insertErr) {
        console.error('[setup/execute] Failed to enqueue jobs:', insertErr);
        await adminClient
          .from('setup_builds')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', buildId);
        return NextResponse.json({
          error: 'Failed to enqueue enrichment jobs',
          structural_result: structuralResult,
        }, { status: 500 });
      }
    }

    await adminClient
      .from('setup_builds')
      .update({ total_jobs: jobs.length })
      .eq('id', buildId);

    // If there are no enrichment jobs (e.g. trivial plan with no lists/docs),
    // mark the build complete immediately.
    if (jobs.length === 0) {
      await adminClient
        .from('setup_builds')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', buildId);
    }

    // Best-effort kick to the worker so the user sees progress immediately
    // rather than waiting for the next cron tick. Do not await.
    triggerWorker(request).catch(() => undefined);

    return NextResponse.json({
      build_id: buildId,
      started_at: startedAt,
      estimated_completion_at: eta.completionAtIso,
      eta_minutes: eta.minutes,
      structural_result: structuralResult,
      total_jobs: jobs.length,
    });
  } catch (err) {
    console.error('[setup/execute] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Job builder
// ---------------------------------------------------------------------------

interface JobInsertRow {
  build_id: string;
  workspace_id: string;
  type: 'list_tasks' | 'doc_content' | 'list_views';
  target_clickup_id: string;
  target_name: string;
  parent_name: string | null;
  payload: Record<string, unknown>;
  status: 'pending';
}

function buildEnrichmentJobs(args: {
  buildId: string;
  workspaceId: string;
  plan: SetupPlan;
  structuralResult: { items: ExecutionItem[] };
  planTier: string;
}): JobInsertRow[] {
  const { buildId, workspaceId, plan, structuralResult, planTier } = args;
  const out: JobInsertRow[] = [];

  const successfulItems = structuralResult.items.filter(
    (i) => (i.status === 'success' || i.status === 'skipped') && !!i.clickupId,
  );

  const availableTags = (plan.recommended_tags ?? []).map((t) => t.name);

  // Build a quick name->ListPlan lookup so we can match successful list items
  // back to the slice of plan we want to enrich them with.
  for (const item of successfulItems) {
    if (item.type !== 'list') continue;
    const found = findListInPlan(plan, item.name, item.parentName);
    if (!found) continue;
    out.push({
      build_id: buildId,
      workspace_id: workspaceId,
      type: 'list_tasks',
      target_clickup_id: item.clickupId!,
      target_name: item.name,
      parent_name: item.parentName ?? null,
      payload: {
        type: 'list_tasks',
        context: plan.context ?? null,
        spaceName: found.space.name,
        spacePurpose: found.space.purpose,
        listPlan: found.list,
        availableTags,
      },
      status: 'pending',
    });

    // Per-list views: independent unit of work, gets its own row.
    out.push({
      build_id: buildId,
      workspace_id: workspaceId,
      type: 'list_views',
      target_clickup_id: item.clickupId!,
      target_name: item.name,
      parent_name: item.parentName ?? null,
      payload: { type: 'list_views', planTier },
      status: 'pending',
    });
  }

  // Doc content jobs: only for newly successful docs that don't already have
  // baked-in content (legacy plans).
  for (const item of successfulItems) {
    if (item.type !== 'doc') continue;
    const docPlan = plan.recommended_docs?.find((d) => d.name === item.name);
    if (!docPlan) continue;
    if (docPlan.content && docPlan.content.trim().length > 0) continue;
    out.push({
      build_id: buildId,
      workspace_id: workspaceId,
      type: 'doc_content',
      target_clickup_id: item.clickupId!,
      target_name: item.name,
      parent_name: null,
      payload: {
        type: 'doc_content',
        context: plan.context ?? null,
        docPlan,
      },
      status: 'pending',
    });
  }

  return out;
}

function findListInPlan(
  plan: SetupPlan,
  listName: string,
  parentName: string | undefined,
): { list: SetupPlan['spaces'][number]['folders'][number]['lists'][number]; space: SetupPlan['spaces'][number] } | null {
  for (const space of plan.spaces) {
    if (space.lists && parentName === space.name) {
      const hit = space.lists.find((l) => l.name === listName);
      if (hit) return { list: hit, space };
    }
    for (const folder of space.folders) {
      if (folder.name === parentName) {
        const hit = folder.lists.find((l) => l.name === listName);
        if (hit) return { list: hit, space };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Best-effort worker trigger (so the user sees progress immediately)
// ---------------------------------------------------------------------------

async function triggerWorker(request: NextRequest): Promise<void> {
  const baseUrl = new URL(request.url).origin;
  await fetch(`${baseUrl}/api/setup/run-enrichment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal trigger header; the worker accepts it as auth alongside the
      // cron secret and the user session cookie.
      'x-internal-trigger': process.env.INTERNAL_TRIGGER_SECRET ?? '',
    },
    body: JSON.stringify({ source: 'execute' }),
  }).catch(() => undefined);
}

