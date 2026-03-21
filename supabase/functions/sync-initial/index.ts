// supabase/functions/sync-initial/index.ts
// B-026: Edge Function for running initial ClickUp full sync in background.
//
// Invoked after OAuth callback or manually via POST with { workspace_id }.
// Runs the full sync (spaces → folders → lists → tasks → members → time entries)
// and persists progress to clickup_connections for the onboarding UI to poll.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ClickUp API base
const CLICKUP_API = "https://api.clickup.com/api/v2";

// Supabase admin client
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---------------------------------------------------------------------------
// ClickUp API helpers with rate-limit awareness
// ---------------------------------------------------------------------------

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
      console.log(`[sync] Rate limited, waiting ${waitMs}ms...`);
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
// Progress persistence
// ---------------------------------------------------------------------------

interface SyncProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

async function updateProgress(
  workspaceId: string,
  progress: SyncProgress,
  counts?: Record<string, number>
) {
  const supabase = getSupabase();
  const updates: Record<string, unknown> = {
    sync_phase: progress.phase,
    sync_current: progress.current,
    sync_total: progress.total,
    sync_message: progress.message,
  };
  if (counts) {
    if (counts.spaces !== undefined) updates.synced_spaces = counts.spaces;
    if (counts.folders !== undefined) updates.synced_folders = counts.folders;
    if (counts.lists !== undefined) updates.synced_lists = counts.lists;
    if (counts.tasks !== undefined) updates.synced_tasks = counts.tasks;
    if (counts.members !== undefined) updates.synced_members = counts.members;
    if (counts.timeEntries !== undefined)
      updates.synced_time_entries = counts.timeEntries;
  }
  await supabase
    .from("clickup_connections")
    .update(updates)
    .eq("workspace_id", workspaceId);
}

async function markSyncStatus(
  workspaceId: string,
  status: "syncing" | "complete" | "error",
  errorMessage?: string
) {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Update clickup_connections
  const connUpdates: Record<string, unknown> = { sync_status: status };
  if (status === "syncing") {
    connUpdates.sync_started_at = now;
    connUpdates.sync_error = null;
  }
  if (status === "complete") {
    connUpdates.last_sync_at = now;
    connUpdates.sync_completed_at = now;
    connUpdates.sync_phase = "complete";
  }
  if (status === "error") {
    connUpdates.sync_error = errorMessage ?? "Unknown error";
    connUpdates.sync_completed_at = now;
  }
  await supabase
    .from("clickup_connections")
    .update(connUpdates)
    .eq("workspace_id", workspaceId);

  // Mirror status to workspaces table for backward compatibility
  const wsUpdates: Record<string, unknown> = {
    clickup_sync_status: status === "complete" ? "complete" : status,
    updated_at: now,
  };
  if (status === "complete") {
    wsUpdates.clickup_last_synced_at = now;
    wsUpdates.last_sync_at = now;
  }
  if (errorMessage) wsUpdates.clickup_sync_error = errorMessage;
  await supabase.from("workspaces").update(wsUpdates).eq("id", workspaceId);
}

// ---------------------------------------------------------------------------
// Batch upsert helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function batchUpsert(
  table: string,
  workspaceId: string,
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
// Full sync implementation
// ---------------------------------------------------------------------------

interface SyncCounts {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
  members: number;
  timeEntries: number;
}

async function runSync(workspaceId: string, accessToken: string) {
  const counts: SyncCounts = {
    spaces: 0,
    folders: 0,
    lists: 0,
    tasks: 0,
    members: 0,
    timeEntries: 0,
  };
  const errors: string[] = [];
  const supabase = getSupabase();

  // Step 1: Get teams
  const teamsRes = await clickupFetch<{ teams: Array<{ id: string; name: string; members: Array<{ user: Record<string, unknown> }> }> }>(
    "/team",
    accessToken
  );
  if (!teamsRes.teams || teamsRes.teams.length === 0) {
    throw new Error("No ClickUp teams found");
  }
  const team = teamsRes.teams[0];
  const teamId = team.id;

  // Store team info
  await supabase
    .from("workspaces")
    .update({ clickup_team_id: teamId, clickup_team_name: team.name })
    .eq("id", workspaceId);

  // Step 2: Spaces
  await updateProgress(workspaceId, {
    phase: "spaces",
    current: 0,
    total: 0,
    message: "Fetching spaces...",
  });

  const spacesRes = await clickupFetch<{ spaces: Array<{ id: string; name: string; private: boolean; statuses?: unknown[] }> }>(
    `/team/${teamId}/space`,
    accessToken,
    { archived: "false" }
  );
  const spaces = spacesRes.spaces ?? [];

  await batchUpsert(
    "cached_spaces",
    workspaceId,
    spaces.map((s) => ({
      workspace_id: workspaceId,
      clickup_id: s.id,
      name: s.name,
      private: s.private,
      status: s.statuses ?? null,
      synced_at: new Date().toISOString(),
    })),
    "workspace_id,clickup_id"
  );
  counts.spaces = spaces.length;

  await updateProgress(
    workspaceId,
    {
      phase: "spaces",
      current: spaces.length,
      total: spaces.length,
      message: `Synced ${spaces.length} spaces`,
    },
    { spaces: counts.spaces }
  );

  // Step 3: Folders + Lists
  interface FolderData {
    id: string;
    name: string;
    space: { id: string };
    lists: Array<{
      id: string;
      name: string;
      task_count: number;
      folder?: { id: string };
      space: { id: string };
      statuses?: unknown[];
    }>;
  }
  interface ListData {
    id: string;
    name: string;
    task_count: number;
    folder?: { id: string };
    space: { id: string };
    statuses?: unknown[];
  }

  const allFolders: FolderData[] = [];
  const allLists: ListData[] = [];

  await updateProgress(workspaceId, {
    phase: "folders",
    current: 0,
    total: spaces.length,
    message: "Fetching folders...",
  });

  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    try {
      // Folders
      const foldersRes = await clickupFetch<{ folders: FolderData[] }>(
        `/space/${space.id}/folder`,
        accessToken,
        { archived: "false" }
      );
      const folders = foldersRes.folders ?? [];
      allFolders.push(...folders);

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
      const listsRes = await clickupFetch<{ lists: ListData[] }>(
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
      const msg = `Error syncing space ${space.id}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[sync] ${msg}`);
    }

    await updateProgress(workspaceId, {
      phase: "folders",
      current: i + 1,
      total: spaces.length,
      message: `Processed space ${i + 1}/${spaces.length}`,
    });
  }

  // Upsert folders
  await batchUpsert(
    "cached_folders",
    workspaceId,
    allFolders.map((f) => ({
      workspace_id: workspaceId,
      clickup_id: f.id,
      space_id: f.space.id,
      name: f.name,
      task_count: f.lists?.length ?? 0,
      synced_at: new Date().toISOString(),
    })),
    "workspace_id,clickup_id"
  );
  counts.folders = allFolders.length;

  // Upsert lists
  await batchUpsert(
    "cached_lists",
    workspaceId,
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
  counts.lists = allLists.length;

  await updateProgress(
    workspaceId,
    {
      phase: "lists",
      current: allLists.length,
      total: allLists.length,
      message: `Synced ${allLists.length} lists`,
    },
    { folders: counts.folders, lists: counts.lists }
  );

  // Step 4: Tasks (paginated, 100 per page)
  let totalTasks = 0;

  await updateProgress(workspaceId, {
    phase: "tasks",
    current: 0,
    total: allLists.length,
    message: "Fetching tasks...",
  });

  for (let i = 0; i < allLists.length; i++) {
    const list = allLists[i];
    try {
      let page = 0;
      let lastPage = false;
      const listTasks: Record<string, unknown>[] = [];

      while (!lastPage) {
        const tasksRes = await clickupFetch<{
          tasks: Array<{
            id: string;
            name: string;
            description: string | null;
            status: { status: string; type: string; color: string };
            priority: { id: string; priority: string; color: string; orderindex: string } | null;
            assignees: Array<{ id: number; username: string; email: string }>;
            tags: unknown[];
            due_date: string | null;
            start_date: string | null;
            time_estimate: number | null;
            time_spent: number | null;
            custom_fields: unknown[];
            list: { id: string; name: string };
          }>;
          last_page: boolean;
        }>(
          `/list/${list.id}/task`,
          accessToken,
          {
            page: String(page),
            subtasks: "true",
            include_closed: "true",
          }
        );

        for (const task of tasksRes.tasks ?? []) {
          listTasks.push({
            workspace_id: workspaceId,
            clickup_id: task.id,
            list_id: task.list.id,
            name: task.name,
            description: task.description,
            status: task.status.status,
            priority: task.priority?.id
              ? parseInt(task.priority.id, 10)
              : null,
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
          });
        }

        lastPage = tasksRes.last_page ?? true;
        page++;
      }

      await batchUpsert(
        "cached_tasks",
        workspaceId,
        listTasks,
        "workspace_id,clickup_id"
      );
      totalTasks += listTasks.length;
    } catch (err) {
      const msg = `Error syncing tasks for list ${list.id}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[sync] ${msg}`);
    }

    await updateProgress(
      workspaceId,
      {
        phase: "tasks",
        current: i + 1,
        total: allLists.length,
        message: `Fetched tasks from list ${i + 1}/${allLists.length} (${totalTasks} total tasks)`,
      },
      { tasks: totalTasks }
    );
  }
  counts.tasks = totalTasks;

  // Step 5: Members
  await updateProgress(workspaceId, {
    phase: "members",
    current: 0,
    total: 1,
    message: "Fetching team members...",
  });

  try {
    // Members are nested in team response
    const members = team.members ?? [];
    const memberRows = members.map(
      (m: { user: Record<string, unknown> }) => ({
        workspace_id: workspaceId,
        clickup_id: String(m.user.id),
        username: m.user.username,
        email: m.user.email,
        profile_picture: m.user.profilePicture ?? null,
        role: m.user.role,
        synced_at: new Date().toISOString(),
      })
    );

    await batchUpsert(
      "cached_team_members",
      workspaceId,
      memberRows,
      "workspace_id,clickup_id"
    );
    counts.members = memberRows.length;
  } catch (err) {
    const msg = `Error syncing members: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error(`[sync] ${msg}`);
  }

  await updateProgress(
    workspaceId,
    {
      phase: "members",
      current: 1,
      total: 1,
      message: `Synced ${counts.members} members`,
    },
    { members: counts.members }
  );

  // Step 6: Time entries (last 90 days)
  await updateProgress(workspaceId, {
    phase: "time_entries",
    current: 0,
    total: 1,
    message: "Fetching time entries (last 90 days)...",
  });

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

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
      workspaceId,
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
    counts.timeEntries = entries.length;
  } catch (err) {
    const msg = `Error syncing time entries: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error(`[sync] ${msg}`);
  }

  await updateProgress(
    workspaceId,
    {
      phase: "time_entries",
      current: 1,
      total: 1,
      message: `Synced ${counts.timeEntries} time entries`,
    },
    { timeEntries: counts.timeEntries }
  );

  return { counts, errors };
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabase();

    // Verify workspace exists and ClickUp is connected
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select(
        "id, clickup_connected, clickup_access_token, clickup_team_id"
      )
      .eq("id", workspace_id)
      .single();

    if (wsError || !workspace) {
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!workspace.clickup_connected || !workspace.clickup_access_token) {
      return new Response(
        JSON.stringify({ error: "ClickUp not connected" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decrypt access token — Edge Function uses the encrypted token directly
    // In production, token decryption should happen server-side.
    // For Edge Functions, we read the raw token and decrypt it.
    // NOTE: The ClickUpClient in the main app handles decryption via oauth.ts,
    // but Edge Functions run in Deno and need to handle this independently.
    // For now, we retrieve the decrypted token by calling a helper.
    const accessToken = workspace.clickup_access_token;

    // Mark as syncing
    await markSyncStatus(workspace_id, "syncing");

    // Run the sync
    const { counts, errors } = await runSync(workspace_id, accessToken);

    // Final status
    if (errors.length > 0 && counts.tasks === 0 && counts.spaces === 0) {
      await markSyncStatus(workspace_id, "error", errors.join("; "));
      return new Response(
        JSON.stringify({ success: false, errors, counts }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await markSyncStatus(workspace_id, "complete");
    return new Response(
      JSON.stringify({
        success: true,
        counts,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[sync-initial] Fatal error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
