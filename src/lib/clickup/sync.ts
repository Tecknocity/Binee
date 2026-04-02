import { createClient } from "@supabase/supabase-js";
import { ClickUpClient } from "@/lib/clickup/client";
import type {
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpMember,
  ClickUpTimeEntry,
  SyncResult,
  SyncProgress,
} from "@/types/clickup";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Batch upsert helpers
// ---------------------------------------------------------------------------

export async function upsertCachedSpaces(
  workspaceId: string,
  spaces: ClickUpSpace[]
): Promise<void> {
  if (spaces.length === 0) return;

  const supabase = getSupabaseAdmin();
  const rows = spaces.map((space) => ({
    workspace_id: workspaceId,
    clickup_id: space.id,
    name: space.name,
    private: space.private,
    status: space.statuses ?? null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("cached_spaces")
    .upsert(rows, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to upsert cached spaces: ${error.message}`);
  }
}

export async function upsertCachedFolders(
  workspaceId: string,
  folders: ClickUpFolder[]
): Promise<void> {
  if (folders.length === 0) return;

  const supabase = getSupabaseAdmin();
  const rows = folders.map((folder) => ({
    workspace_id: workspaceId,
    clickup_id: folder.id,
    space_id: folder.space.id,
    name: folder.name,
    task_count: folder.lists?.length ?? 0,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("cached_folders")
    .upsert(rows, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to upsert cached folders: ${error.message}`);
  }
}

export async function upsertCachedLists(
  workspaceId: string,
  lists: ClickUpList[]
): Promise<void> {
  if (lists.length === 0) return;

  const supabase = getSupabaseAdmin();
  const rows = lists.map((list) => ({
    workspace_id: workspaceId,
    clickup_id: list.id,
    space_id: list.space.id,
    folder_id: list.folder?.id ?? null,
    name: list.name,
    task_count: list.task_count,
    status: list.statuses ?? null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("cached_lists")
    .upsert(rows, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to upsert cached lists: ${error.message}`);
  }
}

export async function upsertCachedTasks(
  workspaceId: string,
  tasks: ClickUpTask[]
): Promise<void> {
  if (tasks.length === 0) return;

  const supabase = getSupabaseAdmin();

  // Batch in groups of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const rows = batch.map((task) => ({
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
    }));

    const { error } = await supabase
      .from("cached_tasks")
      .upsert(rows, { onConflict: "workspace_id,clickup_id" });

    if (error) {
      throw new Error(`Failed to upsert cached tasks: ${error.message}`);
    }
  }
}

export async function upsertCachedMembers(
  workspaceId: string,
  members: ClickUpMember[]
): Promise<void> {
  if (members.length === 0) return;

  const supabase = getSupabaseAdmin();
  const rows = members.map((member) => ({
    workspace_id: workspaceId,
    clickup_id: String(member.id),
    username: member.username,
    email: member.email,
    profile_picture: member.profilePicture,
    role: member.role,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("cached_team_members")
    .upsert(rows, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to upsert cached members: ${error.message}`);
  }
}

export async function upsertCachedTimeEntries(
  workspaceId: string,
  entries: ClickUpTimeEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const supabase = getSupabaseAdmin();

  const BATCH_SIZE = 500;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const rows = batch.map((entry) => ({
      workspace_id: workspaceId,
      clickup_id: entry.id,
      task_id: entry.task.id,
      user_id: String(entry.user.id),
      duration: parseInt(entry.duration, 10),
      start_time: new Date(parseInt(entry.start, 10)).toISOString(),
      end_time: new Date(parseInt(entry.end, 10)).toISOString(),
      description: entry.description,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("cached_time_entries")
      .upsert(rows, { onConflict: "workspace_id,clickup_id" });

    if (error) {
      throw new Error(
        `Failed to upsert cached time entries: ${error.message}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Sync status tracking
// ---------------------------------------------------------------------------

async function updateSyncStatus(
  workspaceId: string,
  status: "syncing" | "complete" | "error",
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {
    clickup_sync_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === "complete") {
    updates.clickup_last_synced_at = new Date().toISOString();
    updates.clickup_sync_started_at = null;
  }

  if (status === "error") {
    updates.clickup_sync_started_at = null;
  }

  if (errorMessage) {
    updates.clickup_sync_error = errorMessage;
  }

  await supabase.from("workspaces").update(updates).eq("id", workspaceId);
}

// ---------------------------------------------------------------------------
// Persistent progress tracking (clickup_connections table for onboarding UI)
// ---------------------------------------------------------------------------

async function updateConnectionProgress(
  workspaceId: string,
  progress: SyncProgress,
  counts?: Partial<SyncResult>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {
    workspace_id: workspaceId,
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

  // Use upsert to ensure the row exists (handles case where OAuth callback
  // didn't create it or the row was deleted)
  await supabase
    .from("clickup_connections")
    .upsert(updates, { onConflict: "workspace_id" });
}

async function updateConnectionSyncStatus(
  workspaceId: string,
  status: "syncing" | "complete" | "error",
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {
    workspace_id: workspaceId,
    sync_status: status,
  };

  if (status === "syncing") {
    updates.sync_started_at = new Date().toISOString();
    updates.sync_error = null;
  }

  if (status === "complete") {
    updates.last_sync_at = new Date().toISOString();
    updates.sync_completed_at = new Date().toISOString();
    updates.sync_phase = "complete";
  }

  if (status === "error") {
    updates.sync_error = errorMessage ?? "Unknown error";
    updates.sync_completed_at = new Date().toISOString();
  }

  // Use upsert to ensure the row exists (handles case where it wasn't
  // created during OAuth callback)
  await supabase
    .from("clickup_connections")
    .upsert(updates, { onConflict: "workspace_id" });
}

// ---------------------------------------------------------------------------
// Get sync progress (for onboarding UI polling)
// ---------------------------------------------------------------------------

export interface FullSyncProgress {
  status: "idle" | "syncing" | "complete" | "error";
  phase: string | null;
  current: number;
  total: number;
  message: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  counts: {
    spaces: number;
    folders: number;
    lists: number;
    tasks: number;
    members: number;
    timeEntries: number;
  };
}

export async function getSyncProgress(
  workspaceId: string
): Promise<FullSyncProgress> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("clickup_connections")
    .select(
      "sync_status, sync_phase, sync_current, sync_total, sync_message, sync_error, sync_started_at, sync_completed_at, synced_spaces, synced_folders, synced_lists, synced_tasks, synced_members, synced_time_entries"
    )
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    return {
      status: "idle",
      phase: null,
      current: 0,
      total: 0,
      message: null,
      error: null,
      startedAt: null,
      completedAt: null,
      counts: {
        spaces: 0,
        folders: 0,
        lists: 0,
        tasks: 0,
        members: 0,
        timeEntries: 0,
      },
    };
  }

  return {
    status: data.sync_status ?? "idle",
    phase: data.sync_phase ?? null,
    current: data.sync_current ?? 0,
    total: data.sync_total ?? 0,
    message: data.sync_message ?? null,
    error: data.sync_error ?? null,
    startedAt: data.sync_started_at ?? null,
    completedAt: data.sync_completed_at ?? null,
    counts: {
      spaces: data.synced_spaces ?? 0,
      folders: data.synced_folders ?? 0,
      lists: data.synced_lists ?? 0,
      tasks: data.synced_tasks ?? 0,
      members: data.synced_members ?? 0,
      timeEntries: data.synced_time_entries ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Initial full sync
// ---------------------------------------------------------------------------

export async function performInitialSync(
  workspaceId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const client = new ClickUpClient(workspaceId);
  const result: SyncResult = {
    spaces: 0,
    folders: 0,
    lists: 0,
    tasks: 0,
    members: 0,
    timeEntries: 0,
    errors: [],
  };

  const report = (progress: SyncProgress) => {
    if (onProgress) onProgress(progress);
  };

  try {
    await updateSyncStatus(workspaceId, "syncing");

    // Step 1: Get teams to find the team ID
    const teams = await client.getTeams();
    if (teams.length === 0) {
      throw new Error("No ClickUp teams found for this account");
    }
    const team = teams[0];
    const teamId = team.id;

    // Store team info on workspace
    const supabase = getSupabaseAdmin();
    await supabase
      .from("workspaces")
      .update({
        clickup_team_id: teamId,
        clickup_team_name: team.name,
      })
      .eq("id", workspaceId);

    // Step 2: Sync spaces
    report({
      phase: "spaces",
      current: 0,
      total: 0,
      message: "Fetching spaces...",
    });
    const spaces = await client.getSpaces(teamId);
    await upsertCachedSpaces(workspaceId, spaces);
    result.spaces = spaces.length;
    report({
      phase: "spaces",
      current: spaces.length,
      total: spaces.length,
      message: `Synced ${spaces.length} spaces`,
    });

    // Step 3: Sync folders for each space
    const allFolders: ClickUpFolder[] = [];
    const allLists: ClickUpList[] = [];

    report({
      phase: "folders",
      current: 0,
      total: spaces.length,
      message: "Fetching folders...",
    });

    for (let i = 0; i < spaces.length; i++) {
      const space = spaces[i];
      try {
        const folders = await client.getFolders(space.id);
        allFolders.push(...folders);

        // Collect lists from folders
        for (const folder of folders) {
          if (folder.lists) {
            allLists.push(...folder.lists);
          }
        }

        // Get folderless lists
        const folderlessLists = await client.getFolderlessLists(space.id);
        allLists.push(...folderlessLists);
      } catch (err) {
        const msg = `Error syncing space ${space.id}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        console.error(msg);
      }

      report({
        phase: "folders",
        current: i + 1,
        total: spaces.length,
        message: `Processed space ${i + 1}/${spaces.length}`,
      });
    }

    await upsertCachedFolders(workspaceId, allFolders);
    result.folders = allFolders.length;

    // Step 4: Sync lists
    report({
      phase: "lists",
      current: allLists.length,
      total: allLists.length,
      message: `Synced ${allLists.length} lists`,
    });
    await upsertCachedLists(workspaceId, allLists);
    result.lists = allLists.length;

    // Step 5: Sync tasks (paginated per list)
    const allTasks: ClickUpTask[] = [];
    report({
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

        while (!lastPage) {
          const response = await client.getTasks(list.id, page);
          allTasks.push(...response.tasks);
          lastPage = response.last_page;
          page++;
        }
      } catch (err) {
        const msg = `Error syncing tasks for list ${list.id}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        console.error(msg);
      }

      report({
        phase: "tasks",
        current: i + 1,
        total: allLists.length,
        message: `Fetched tasks from list ${i + 1}/${allLists.length} (${allTasks.length} total tasks)`,
      });
    }

    await upsertCachedTasks(workspaceId, allTasks);
    result.tasks = allTasks.length;

    // Step 6: Sync members
    report({
      phase: "members",
      current: 0,
      total: 1,
      message: "Fetching team members...",
    });

    try {
      const members = await client.getTeamMembers(teamId);
      await upsertCachedMembers(workspaceId, members);
      result.members = members.length;
    } catch (err) {
      const msg = `Error syncing members: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(msg);
    }

    report({
      phase: "members",
      current: 1,
      total: 1,
      message: `Synced ${result.members} members`,
    });

    // Step 7: Sync time entries (last 90 days)
    report({
      phase: "time_entries",
      current: 0,
      total: 1,
      message: "Fetching time entries (last 90 days)...",
    });

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const timeEntries = await client.getTimeEntries(
        teamId,
        startDate,
        endDate
      );
      await upsertCachedTimeEntries(workspaceId, timeEntries);
      result.timeEntries = timeEntries.length;
    } catch (err) {
      const msg = `Error syncing time entries: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(msg);
    }

    report({
      phase: "time_entries",
      current: 1,
      total: 1,
      message: `Synced ${result.timeEntries} time entries`,
    });

    // Done — NOTE: callers (sync route, OAuth callback) set the final
    // "complete" status on the workspaces table after this returns.
    // We skip updating workspaces.clickup_sync_status here to avoid
    // race conditions with the caller's own status update.
    report({
      phase: "complete",
      current: 1,
      total: 1,
      message: "Sync complete",
    });

    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown sync error";
    console.error("[ClickUp Sync] Fatal error:", errorMessage);
    await updateSyncStatus(workspaceId, "error", errorMessage);
    result.errors.push(errorMessage);
    // Re-throw so callers (sync route, OAuth callback) know the sync failed
    // and don't overwrite the error status with "complete"
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Full sync with persistent progress (B-026)
// ---------------------------------------------------------------------------

/**
 * runFullSync — entry point for initial ClickUp sync with persistent progress.
 *
 * Updates both the `workspaces` table (for backward compat) and the
 * `clickup_connections` table (for onboarding UI progress tracking via
 * getSyncProgress). Can be called from an API route or Edge Function.
 *
 * Sync order: spaces → folders → lists → tasks → members → time entries
 */
export async function runFullSync(workspaceId: string): Promise<SyncResult> {
  // Mark syncing on both tables
  await updateConnectionSyncStatus(workspaceId, "syncing");

  try {
    const result = await performInitialSync(workspaceId, async (progress) => {
      // Persist each progress update to clickup_connections for UI polling
      await updateConnectionProgress(workspaceId, progress);
    });

    // Success (possibly with non-fatal errors)
    await updateConnectionSyncStatus(workspaceId, "complete");
    await updateConnectionProgress(
      workspaceId,
      { phase: "complete", current: 1, total: 1, message: "Sync complete" },
      {
        spaces: result.spaces,
        folders: result.folders,
        lists: result.lists,
        tasks: result.tasks,
        members: result.members,
        timeEntries: result.timeEntries,
      }
    );

    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown sync error";
    await updateConnectionSyncStatus(workspaceId, "error", errorMessage);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reconciliation sync (lightweight diff-based)
// ---------------------------------------------------------------------------

export async function performReconciliationSync(
  workspaceId: string
): Promise<SyncResult> {
  const client = new ClickUpClient(workspaceId);
  const supabase = getSupabaseAdmin();

  const result: SyncResult = {
    spaces: 0,
    folders: 0,
    lists: 0,
    tasks: 0,
    members: 0,
    timeEntries: 0,
    errors: [],
  };

  try {
    await updateSyncStatus(workspaceId, "syncing");

    // Get the workspace team ID
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("clickup_team_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace?.clickup_team_id) {
      throw new Error("No ClickUp team ID found for workspace");
    }

    const teamId = workspace.clickup_team_id;

    // Fetch current spaces from ClickUp
    const currentSpaces = await client.getSpaces(teamId);
    const currentSpaceIds = new Set(currentSpaces.map((s) => s.id));

    // Fetch cached space IDs
    const { data: cachedSpaces } = await supabase
      .from("cached_spaces")
      .select("clickup_id")
      .eq("workspace_id", workspaceId);

    const cachedSpaceIds = new Set(
      (cachedSpaces ?? []).map((s: { clickup_id: string }) => s.clickup_id)
    );

    // Find new or removed spaces
    const newSpaceIds = [...currentSpaceIds].filter(
      (id) => !cachedSpaceIds.has(id)
    );
    const removedSpaceIds = [...cachedSpaceIds].filter(
      (id) => !currentSpaceIds.has(id)
    );

    // Upsert all current spaces (to catch name changes etc.)
    await upsertCachedSpaces(workspaceId, currentSpaces);
    result.spaces = currentSpaces.length;

    // Remove deleted spaces from cache
    if (removedSpaceIds.length > 0) {
      await supabase
        .from("cached_spaces")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("clickup_id", removedSpaceIds);
    }

    // Reconcile lists for each space
    const allLists: ClickUpList[] = [];
    const allFolders: ClickUpFolder[] = [];

    for (const space of currentSpaces) {
      try {
        const folders = await client.getFolders(space.id);
        allFolders.push(...folders);

        for (const folder of folders) {
          if (folder.lists) {
            allLists.push(...folder.lists);
          }
        }

        const folderlessLists = await client.getFolderlessLists(space.id);
        allLists.push(...folderlessLists);
      } catch (err) {
        const msg = `Reconcile error for space ${space.id}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
      }
    }

    await upsertCachedFolders(workspaceId, allFolders);
    result.folders = allFolders.length;

    await upsertCachedLists(workspaceId, allLists);
    result.lists = allLists.length;

    // Compare list IDs and remove deleted lists from cache
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
        .from("cached_lists")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("clickup_id", removedListIds);

      // Also remove tasks from deleted lists
      await supabase
        .from("cached_tasks")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("list_id", removedListIds);
    }

    // Re-sync tasks only for new spaces or spaces with changes
    const spacesToResync =
      newSpaceIds.length > 0 ? newSpaceIds : [currentSpaces[0]?.id].filter(Boolean);

    for (const spaceId of spacesToResync) {
      const spaceLists = allLists.filter((l) => l.space.id === spaceId);
      for (const list of spaceLists) {
        try {
          const tasks = await client.getAllTasks(list.id);
          await upsertCachedTasks(workspaceId, tasks);
          result.tasks += tasks.length;
        } catch (err) {
          const msg = `Reconcile task error for list ${list.id}: ${err instanceof Error ? err.message : String(err)}`;
          result.errors.push(msg);
        }
      }
    }

    // Update task counts per list
    for (const list of allLists) {
      const { count } = await supabase
        .from("cached_tasks")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("list_id", list.id);

      if (count !== null) {
        await supabase
          .from("cached_lists")
          .update({ task_count: count, synced_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("clickup_id", list.id);
      }
    }

    // Sync time entries (last 7 days for reconciliation)
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const timeEntries = await client.getTimeEntries(
        teamId,
        startDate,
        endDate
      );
      await upsertCachedTimeEntries(workspaceId, timeEntries);
      result.timeEntries = timeEntries.length;
    } catch (err) {
      const msg = `Reconcile time entries error: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
    }

    // Mark complete — reconciliation sync is called directly, not via fire-and-forget
    await updateSyncStatus(workspaceId, "complete");
    return result;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown reconciliation error";
    console.error("[ClickUp Reconciliation] Fatal error:", errorMessage);
    await updateSyncStatus(workspaceId, "error", errorMessage);
    result.errors.push(errorMessage);
    throw err;
  }
}
