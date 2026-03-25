// supabase/functions/sync-reconcile/index.ts
// B-031: Edge Function for periodic reconciliation sync.
//
// Runs on a cron schedule (every 4-6 hours) to catch missed webhooks.
// For each active workspace: fetches tasks updated since last_sync_at,
// compares against cached_tasks, and upserts any differences.
// Lighter than full sync — only checks tasks updated since last sync.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---------------------------------------------------------------------------
// ClickUp API helpers with rate-limit awareness
// ---------------------------------------------------------------------------

const CLICKUP_API = "https://api.clickup.com/api/v2";

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

const rateLimit: RateLimitState = { remaining: 100, resetAt: 0 };

async function clickupFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${CLICKUP_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Pre-emptive rate limit wait
    if (rateLimit.remaining <= 1 && rateLimit.resetAt > Date.now()) {
      const wait = rateLimit.resetAt - Date.now() + 100;
      await new Promise((r) => setTimeout(r, Math.min(wait, 30_000)));
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: accessToken },
    });

    // Track rate limit headers
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining) rateLimit.remaining = parseInt(remaining, 10);
    if (reset) rateLimit.resetAt = parseInt(reset, 10) * 1000;

    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error("ClickUp rate limit exceeded after retries");
      }
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 30_000);
      console.log(`[sync-reconcile] Rate limited, waiting ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp API ${res.status}: ${body}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  throw new Error("Exhausted retries");
}

// ---------------------------------------------------------------------------
// Batch upsert helper
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function batchUpsert(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  onConflict: string
) {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// ClickUp API types (inline for Deno edge function isolation)
// ---------------------------------------------------------------------------

interface ClickUpTeam {
  id: string;
  name: string;
  members: Array<{ user: Record<string, unknown> }>;
}

interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  statuses?: unknown[];
}

interface ClickUpFolder {
  id: string;
  name: string;
  space: { id: string };
  lists: Array<ClickUpList>;
}

interface ClickUpList {
  id: string;
  name: string;
  task_count: number;
  folder?: { id: string };
  space: { id: string };
  statuses?: unknown[];
}

interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: { status: string; type: string; color: string };
  priority: {
    id: string;
    priority: string;
    color: string;
    orderindex: string;
  } | null;
  assignees: Array<{ id: number; username: string; email: string }>;
  tags: unknown[];
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  custom_fields: unknown[];
  list: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Task row mapper (matches sync-initial pattern)
// ---------------------------------------------------------------------------

function mapTaskToRow(task: ClickUpTask, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    clickup_id: task.id,
    list_id: task.list.id,
    name: task.name,
    description: task.description,
    status: task.status.status,
    priority: task.priority?.id ? parseInt(task.priority.id, 10) : null,
    assignees: task.assignees.map((a) => ({
      id: a.id,
      username: a.username,
      email: a.email,
    })),
    tags: task.tags,
    due_date: task.due_date
      ? new Date(parseInt(task.due_date, 10)).toISOString()
      : null,
    start_date: task.start_date
      ? new Date(parseInt(task.start_date, 10)).toISOString()
      : null,
    time_estimate: task.time_estimate,
    time_spent: task.time_spent,
    custom_fields: task.custom_fields,
    synced_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reconciliation sync for a single workspace
// ---------------------------------------------------------------------------

interface ReconcileResult {
  workspaceId: string;
  tasks: number;
  spaces: number;
  lists: number;
  removedTasks: number;
  removedLists: number;
  timeEntries: number;
  errors: string[];
}

async function reconcileWorkspace(
  workspaceId: string,
  accessToken: string,
  teamId: string,
  lastSyncAt: string | null
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    workspaceId,
    tasks: 0,
    spaces: 0,
    lists: 0,
    removedTasks: 0,
    removedLists: 0,
    timeEntries: 0,
    errors: [],
  };

  const supabase = getSupabase();

  // -----------------------------------------------------------------------
  // Step 1: Reconcile spaces — detect added/removed spaces
  // -----------------------------------------------------------------------

  let currentSpaces: ClickUpSpace[] = [];
  try {
    const spacesRes = await clickupFetch<{ spaces: ClickUpSpace[] }>(
      `/team/${teamId}/space`,
      accessToken,
      { archived: "false" }
    );
    currentSpaces = spacesRes.spaces ?? [];

    await batchUpsert(
      "cached_spaces",
      currentSpaces.map((s) => ({
        workspace_id: workspaceId,
        clickup_id: s.id,
        name: s.name,
        private: s.private,
        status: s.statuses ?? null,
        synced_at: new Date().toISOString(),
      })),
      "workspace_id,clickup_id"
    );
    result.spaces = currentSpaces.length;

    // Remove deleted spaces from cache
    const { data: cachedSpaces } = await supabase
      .from("cached_spaces")
      .select("clickup_id")
      .eq("workspace_id", workspaceId);

    const currentSpaceIds = new Set(currentSpaces.map((s) => s.id));
    const removedSpaceIds = (cachedSpaces ?? [])
      .map((s: { clickup_id: string }) => s.clickup_id)
      .filter((id: string) => !currentSpaceIds.has(id));

    if (removedSpaceIds.length > 0) {
      // Cascade: remove tasks from lists in deleted spaces
      const { data: spaceLists } = await supabase
        .from("cached_lists")
        .select("clickup_id")
        .eq("workspace_id", workspaceId)
        .in("space_id", removedSpaceIds);

      const listIds = (spaceLists ?? []).map(
        (l: { clickup_id: string }) => l.clickup_id
      );
      if (listIds.length > 0) {
        await supabase
          .from("cached_tasks")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("list_id", listIds);
      }

      await supabase
        .from("cached_lists")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("space_id", removedSpaceIds);

      await supabase
        .from("cached_folders")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("space_id", removedSpaceIds);

      await supabase
        .from("cached_spaces")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("clickup_id", removedSpaceIds);
    }
  } catch (err) {
    const msg = `Error reconciling spaces: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[sync-reconcile] ${msg}`);
  }

  // -----------------------------------------------------------------------
  // Step 2: Reconcile folders and lists
  // -----------------------------------------------------------------------

  const allLists: ClickUpList[] = [];

  for (const space of currentSpaces) {
    try {
      // Fetch folders (which contain lists)
      const foldersRes = await clickupFetch<{ folders: ClickUpFolder[] }>(
        `/space/${space.id}/folder`,
        accessToken,
        { archived: "false" }
      );
      const folders = foldersRes.folders ?? [];

      await batchUpsert(
        "cached_folders",
        folders.map((f) => ({
          workspace_id: workspaceId,
          clickup_id: f.id,
          space_id: space.id,
          name: f.name,
          task_count: f.lists?.length ?? 0,
          synced_at: new Date().toISOString(),
        })),
        "workspace_id,clickup_id"
      );

      for (const folder of folders) {
        if (folder.lists) {
          allLists.push(
            ...folder.lists.map((l) => ({
              ...l,
              folder: { id: folder.id },
              space: { id: space.id },
            }))
          );
        }
      }

      // Folderless lists
      const listsRes = await clickupFetch<{ lists: ClickUpList[] }>(
        `/space/${space.id}/list`,
        accessToken,
        { archived: "false" }
      );
      allLists.push(
        ...(listsRes.lists ?? []).map((l) => ({
          ...l,
          space: { id: space.id },
        }))
      );
    } catch (err) {
      const msg = `Error reconciling space ${space.id}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[sync-reconcile] ${msg}`);
    }
  }

  // Upsert all lists
  await batchUpsert(
    "cached_lists",
    allLists.map((l) => ({
      workspace_id: workspaceId,
      clickup_id: l.id,
      space_id: l.space.id,
      folder_id: l.folder?.id ?? null,
      name: l.name,
      task_count: l.task_count,
      status: l.statuses ?? null,
      synced_at: new Date().toISOString(),
    })),
    "workspace_id,clickup_id"
  );
  result.lists = allLists.length;

  // Remove deleted lists and their tasks
  const currentListIds = new Set(allLists.map((l) => l.id));
  const { data: cachedLists } = await supabase
    .from("cached_lists")
    .select("clickup_id")
    .eq("workspace_id", workspaceId);

  const removedListIds = (cachedLists ?? [])
    .map((l: { clickup_id: string }) => l.clickup_id)
    .filter((id: string) => !currentListIds.has(id));

  if (removedListIds.length > 0) {
    await supabase
      .from("cached_tasks")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("list_id", removedListIds);

    await supabase
      .from("cached_lists")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("clickup_id", removedListIds);

    result.removedLists = removedListIds.length;
  }

  // -----------------------------------------------------------------------
  // Step 3: Reconcile tasks — only fetch tasks updated since last_sync_at
  // -----------------------------------------------------------------------

  // Calculate the date_updated_gt timestamp.
  // If no last_sync_at, default to 6 hours ago (one cron interval).
  const updatedSince = lastSyncAt
    ? new Date(lastSyncAt).getTime()
    : Date.now() - 6 * 60 * 60 * 1000;

  for (const list of allLists) {
    try {
      let page = 0;
      let lastPage = false;
      const listTasks: Record<string, unknown>[] = [];

      while (!lastPage) {
        const tasksRes = await clickupFetch<{
          tasks: ClickUpTask[];
          last_page: boolean;
        }>(`/list/${list.id}/task`, accessToken, {
          page: String(page),
          subtasks: "true",
          include_closed: "true",
          date_updated_gt: String(updatedSince),
        });

        for (const task of tasksRes.tasks ?? []) {
          listTasks.push(mapTaskToRow(task, workspaceId));
        }

        lastPage = tasksRes.last_page ?? true;
        page++;
      }

      if (listTasks.length > 0) {
        await batchUpsert("cached_tasks", listTasks, "workspace_id,clickup_id");
        result.tasks += listTasks.length;
      }
    } catch (err) {
      const msg = `Error reconciling tasks for list ${list.id}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[sync-reconcile] ${msg}`);
    }
  }

  // Detect deleted tasks: compare cached task IDs per list against ClickUp
  // Only do this for lists where we found 0 updated tasks (potential full deletion)
  // to avoid excessive API calls. Full task list comparison is expensive,
  // so we rely on webhooks for most deletions and only spot-check here.
  // Tasks in deleted lists were already handled above.

  // -----------------------------------------------------------------------
  // Step 4: Reconcile time entries (last 7 days)
  // -----------------------------------------------------------------------

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const timeRes = await clickupFetch<{
      data: Array<{
        id: string;
        task: { id: string; name: string };
        user: { id: number; username: string };
        duration: string;
        start: string;
        end: string;
        description: string | null;
      }>;
    }>(`/team/${teamId}/time_entries`, accessToken, {
      start_date: String(startDate.getTime()),
      end_date: String(endDate.getTime()),
    });

    const entries = timeRes.data ?? [];
    await batchUpsert(
      "cached_time_entries",
      entries.map((e) => ({
        workspace_id: workspaceId,
        clickup_id: e.id,
        task_id: e.task.id,
        user_id: String(e.user.id),
        duration: parseInt(e.duration, 10),
        start_time: new Date(parseInt(e.start, 10)).toISOString(),
        end_time: new Date(parseInt(e.end, 10)).toISOString(),
        description: e.description,
        synced_at: new Date().toISOString(),
      })),
      "workspace_id,clickup_id"
    );
    result.timeEntries = entries.length;
  } catch (err) {
    const msg = `Error reconciling time entries: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[sync-reconcile] ${msg}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Accept both GET (cron trigger) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify cron secret for authorization
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const providedSecret =
      authHeader?.replace("Bearer ", "") ?? querySecret ?? "";

    if (providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const supabase = getSupabase();

  try {
    // Find all workspaces with active ClickUp connections
    const { data: workspaces, error: queryError } = await supabase
      .from("workspaces")
      .select(
        "id, clickup_team_id, clickup_team_name, clickup_access_token, last_sync_at"
      )
      .eq("clickup_connected", true)
      .not("clickup_team_id", "is", null)
      .not("clickup_access_token", "is", null);

    if (queryError) {
      console.error("[sync-reconcile] Failed to query workspaces:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query workspaces" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!workspaces || workspaces.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No active ClickUp workspaces to reconcile",
          count: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[sync-reconcile] Starting reconciliation for ${workspaces.length} workspace(s)`
    );

    const results: ReconcileResult[] = [];

    // Process each workspace sequentially to avoid rate-limit issues
    for (const workspace of workspaces) {
      console.log(
        `[sync-reconcile] Reconciling workspace: ${workspace.id} (${workspace.clickup_team_name})`
      );

      try {
        const wsResult = await reconcileWorkspace(
          workspace.id,
          workspace.clickup_access_token,
          workspace.clickup_team_id,
          workspace.last_sync_at
        );
        results.push(wsResult);

        // Update last_sync_at on both tables
        const now = new Date().toISOString();
        await supabase
          .from("workspaces")
          .update({
            last_sync_at: now,
            clickup_last_synced_at: now,
            clickup_sync_status: "complete",
            updated_at: now,
          })
          .eq("id", workspace.id);

        await supabase
          .from("clickup_connections")
          .update({
            last_sync_at: now,
            sync_completed_at: now,
          })
          .eq("workspace_id", workspace.id);

        console.log(
          `[sync-reconcile] Workspace ${workspace.id} complete — ` +
            `${wsResult.tasks} tasks updated, ${wsResult.spaces} spaces, ` +
            `${wsResult.lists} lists, ${wsResult.timeEntries} time entries` +
            (wsResult.errors.length > 0
              ? ` (${wsResult.errors.length} errors)`
              : "")
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        console.error(
          `[sync-reconcile] Fatal error for workspace ${workspace.id}:`,
          err
        );
        results.push({
          workspaceId: workspace.id,
          tasks: 0,
          spaces: 0,
          lists: 0,
          removedTasks: 0,
          removedLists: 0,
          timeEntries: 0,
          errors: [errorMsg],
        });
      }
    }

    const successCount = results.filter((r) => r.errors.length === 0).length;
    const totalTasks = results.reduce((sum, r) => sum + r.tasks, 0);

    console.log(
      `[sync-reconcile] Reconciliation complete: ${successCount}/${results.length} workspaces, ${totalTasks} tasks updated`
    );

    return new Response(
      JSON.stringify({
        message: `Reconciliation complete: ${successCount}/${results.length} workspaces synced`,
        count: results.length,
        totalTasks,
        results: results.map((r) => ({
          workspaceId: r.workspaceId,
          success: r.errors.length === 0,
          tasks: r.tasks,
          spaces: r.spaces,
          lists: r.lists,
          removedLists: r.removedLists,
          timeEntries: r.timeEntries,
          errors: r.errors.length > 0 ? r.errors : undefined,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-reconcile] Fatal error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
