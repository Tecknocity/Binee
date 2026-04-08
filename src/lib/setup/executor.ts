// ---------------------------------------------------------------------------
// B-075: Setup Execution Engine
// Automated creation of approved workspace items via ClickUp API.
// Creates Spaces, Folders, Lists, Statuses in dependency order.
// ---------------------------------------------------------------------------

import { ClickUpClient, ClickUpApiError } from "@/lib/clickup/client";
import { upsertCachedSpaces, upsertCachedFolders, upsertCachedLists } from "@/lib/clickup/sync";
import type { ClickUpSpace, ClickUpFolder, ClickUpList } from "@/types/clickup";
import type { SetupPlan, SpacePlan, FolderPlan, ListPlan } from "@/lib/setup/types";
import type { ExistingWorkspaceStructure } from "@/stores/setupStore";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ExecutionItemStatus = "pending" | "success" | "error" | "skipped";

export type ExecutionItemType = "space" | "folder" | "list";

export interface ExecutionItem {
  type: ExecutionItemType;
  name: string;
  /** Parent name for context (e.g. space name for folders, folder name for lists) */
  parentName?: string;
  status: ExecutionItemStatus;
  error?: string;
  /** The ClickUp ID of the created resource */
  clickupId?: string;
}

export interface ExecutionResult {
  success: boolean;
  /** Total items attempted */
  totalItems: number;
  /** Items that succeeded */
  successCount: number;
  /** Items that failed */
  errorCount: number;
  /** Per-item results in execution order */
  items: ExecutionItem[];
  /** IDs of all created spaces (for downstream use) */
  createdSpaceIds: string[];
  /** IDs of all created folders */
  createdFolderIds: string[];
  /** IDs of all created lists */
  createdListIds: string[];
}

// ---------------------------------------------------------------------------
// Progress callback (optional real-time tracking)
// ---------------------------------------------------------------------------

export type ExecutionProgressCallback = (
  completedItem: ExecutionItem,
  progress: { completed: number; total: number }
) => void;

// ---------------------------------------------------------------------------
// Main execution function
// ---------------------------------------------------------------------------

/**
 * Execute an approved setup plan by creating all Spaces, Folders, Lists,
 * and Statuses in the user's ClickUp workspace via the ClickUp API.
 *
 * Items are created in dependency order:
 *   1. Spaces
 *   2. Folders (within their parent spaces)
 *   3. Lists with statuses (within their parent folders)
 *
 * If one item fails, execution continues with remaining items and failures
 * are reported in the result.
 */
export async function executeSetupPlan(
  plan: SetupPlan,
  workspaceId: string,
  accessToken: string,
  onProgress?: ExecutionProgressCallback,
  existingStructure?: ExistingWorkspaceStructure | null,
): Promise<ExecutionResult> {
  const client = new ClickUpClient(workspaceId);

  // Build lookup maps from existing structure for quick matching (case-insensitive)
  const existingSpaces = new Map<string, { clickup_id: string; folders: Map<string, { clickup_id: string; lists: Set<string> }> }>();
  if (existingStructure?.spaces) {
    for (const space of existingStructure.spaces) {
      const folderMap = new Map<string, { clickup_id: string; lists: Set<string> }>();
      for (const folder of space.folders) {
        const listNames = new Set(folder.lists.map((l) => l.name.toLowerCase()));
        folderMap.set(folder.name.toLowerCase(), { clickup_id: folder.clickup_id, lists: listNames });
      }
      existingSpaces.set(space.name.toLowerCase(), { clickup_id: space.clickup_id, folders: folderMap });
    }
  }

  // Build the flat list of items for progress tracking
  const items: ExecutionItem[] = buildExecutionItems(plan);
  const totalItems = items.length;
  let completed = 0;

  const createdSpaceIds: string[] = [];
  const createdFolderIds: string[] = [];
  const createdListIds: string[] = [];

  // Map plan names to created ClickUp IDs for resolving parent references
  const spaceIdMap = new Map<string, string>(); // space name -> clickup id
  const folderIdMap = new Map<string, string>(); // "spaceName/folderName" -> clickup id

  // We need the ClickUp team ID to create spaces
  const teamId = await getTeamId(client);

  // -------------------------------------------------------------------------
  // Phase 1: Create Spaces (or skip if they already exist)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    const item = findItem(items, "space", spacePlan.name);
    const existing = existingSpaces.get(spacePlan.name.toLowerCase());

    if (existing) {
      // Space already exists in ClickUp - skip creation, use existing ID
      spaceIdMap.set(spacePlan.name, existing.clickup_id);
      markSkipped(item, existing.clickup_id);
    } else {
      try {
        const space = await withRetry(() => client.createSpace(teamId, spacePlan.name));
        spaceIdMap.set(spacePlan.name, space.id);
        createdSpaceIds.push(space.id);
        await upsertCachedSpaces(workspaceId, [space]);
        markSuccess(item, space.id);
      } catch (err) {
        markError(item, err);
      }
    }

    completed++;
    onProgress?.(item, { completed, total: totalItems });
  }

  // -------------------------------------------------------------------------
  // Phase 2: Create Folders (or skip if they already exist)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    const spaceId = spaceIdMap.get(spacePlan.name);
    const existingSpace = existingSpaces.get(spacePlan.name.toLowerCase());

    for (const folderPlan of spacePlan.folders) {
      const item = findItem(items, "folder", folderPlan.name, spacePlan.name);

      if (!spaceId) {
        markError(item, new Error(`Skipped: parent space "${spacePlan.name}" was not created`));
        completed++;
        onProgress?.(item, { completed, total: totalItems });
        continue;
      }

      const existingFolder = existingSpace?.folders.get(folderPlan.name.toLowerCase());
      if (existingFolder) {
        // Folder already exists - skip creation, use existing ID
        const folderKey = `${spacePlan.name}/${folderPlan.name}`;
        folderIdMap.set(folderKey, existingFolder.clickup_id);
        markSkipped(item, existingFolder.clickup_id);
      } else {
        try {
          const folder = await withRetry(() => client.createFolder(spaceId, folderPlan.name));
          const folderKey = `${spacePlan.name}/${folderPlan.name}`;
          folderIdMap.set(folderKey, folder.id);
          createdFolderIds.push(folder.id);
          await upsertCachedFolders(workspaceId, [folder]);
          markSuccess(item, folder.id);
        } catch (err) {
          markError(item, err);
        }
      }

      completed++;
      onProgress?.(item, { completed, total: totalItems });
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Create Lists with Statuses (or skip if they already exist)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    const existingSpace = existingSpaces.get(spacePlan.name.toLowerCase());

    for (const folderPlan of spacePlan.folders) {
      const folderKey = `${spacePlan.name}/${folderPlan.name}`;
      const folderId = folderIdMap.get(folderKey);
      const existingFolder = existingSpace?.folders.get(folderPlan.name.toLowerCase());

      for (const listPlan of folderPlan.lists) {
        const item = findItem(items, "list", listPlan.name, folderPlan.name);

        if (!folderId) {
          markError(item, new Error(`Skipped: parent folder "${folderPlan.name}" was not created`));
          completed++;
          onProgress?.(item, { completed, total: totalItems });
          continue;
        }

        const listExists = existingFolder?.lists.has(listPlan.name.toLowerCase());
        if (listExists) {
          // List already exists - skip creation
          markSkipped(item);
        } else {
          try {
            const list = await withRetry(() => createListWithStatuses(client, folderId, listPlan));
            createdListIds.push(list.id);
            await upsertCachedLists(workspaceId, [list]);
            markSuccess(item, list.id);
          } catch (err) {
            markError(item, err);
          }
        }

        completed++;
        onProgress?.(item, { completed, total: totalItems });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 4: Create Tags (in the first space that has an ID)
  // -------------------------------------------------------------------------
  if (plan.recommended_tags && plan.recommended_tags.length > 0) {
    const firstSpaceId = createdSpaceIds[0] || spaceIdMap.values().next().value;
    if (firstSpaceId) {
      for (const tag of plan.recommended_tags) {
        try {
          await withRetry(() =>
            client.post(`/space/${firstSpaceId}/tag`, {
              tag: { name: tag.name, tag_bg: tag.tag_bg, tag_fg: tag.tag_fg },
            })
          );
        } catch {
          // Tags are best-effort; don't fail the whole setup
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5: Create Docs
  // -------------------------------------------------------------------------
  if (plan.recommended_docs && plan.recommended_docs.length > 0) {
    for (const doc of plan.recommended_docs) {
      try {
        const body: Record<string, unknown> = { name: doc.name };
        if (doc.content) body.content = doc.content;
        await withRetry(() => client.post(`/team/${teamId}/doc`, body));
      } catch {
        // Docs are best-effort
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 6: Create Goals
  // -------------------------------------------------------------------------
  if (plan.recommended_goals && plan.recommended_goals.length > 0) {
    for (const goal of plan.recommended_goals) {
      try {
        const body: Record<string, unknown> = {
          name: goal.name,
          due_date: new Date(goal.due_date).getTime(),
        };
        if (goal.description) body.description = goal.description;
        if (goal.color) body.color = goal.color;
        await withRetry(() => client.post(`/team/${teamId}/goal`, body));
      } catch {
        // Goals are best-effort
      }
    }
  }

  // -------------------------------------------------------------------------
  // Build final result
  // -------------------------------------------------------------------------
  const successCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const skippedCount = items.filter((i) => i.status === "skipped").length;

  return {
    success: errorCount === 0,
    totalItems,
    successCount,
    errorCount,
    items,
    createdSpaceIds,
    createdFolderIds,
    createdListIds,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat list of all execution items from the plan for tracking.
 */
function buildExecutionItems(plan: SetupPlan): ExecutionItem[] {
  const items: ExecutionItem[] = [];

  for (const space of plan.spaces) {
    items.push({ type: "space", name: space.name, status: "pending" });

    for (const folder of space.folders) {
      items.push({
        type: "folder",
        name: folder.name,
        parentName: space.name,
        status: "pending",
      });

      for (const list of folder.lists) {
        items.push({
          type: "list",
          name: list.name,
          parentName: folder.name,
          status: "pending",
        });
      }
    }
  }

  return items;
}

/**
 * Find a specific item in the items list by type, name, and optional parent.
 */
function findItem(
  items: ExecutionItem[],
  type: ExecutionItemType,
  name: string,
  parentName?: string
): ExecutionItem {
  const item = items.find(
    (i) =>
      i.type === type &&
      i.name === name &&
      (parentName === undefined || i.parentName === parentName)
  );
  // Should never happen if buildExecutionItems is correct
  if (!item) {
    throw new Error(`Execution item not found: ${type} "${name}"`);
  }
  return item;
}

function markSuccess(item: ExecutionItem, clickupId: string): void {
  item.status = "success";
  item.clickupId = clickupId;
}

function markError(item: ExecutionItem, err: unknown): void {
  item.status = "error";
  if (err instanceof ClickUpApiError && err.statusCode === 403) {
    item.error = `Not allowed by ClickUp. Your plan may limit the number of ${item.type === 'space' ? 'spaces' : item.type === 'folder' ? 'folders' : 'lists'} you can create.`;
  } else {
    item.error = err instanceof Error ? err.message : String(err);
  }
}

function markSkipped(item: ExecutionItem, clickupId?: string): void {
  item.status = "skipped";
  if (clickupId) item.clickupId = clickupId;
}

/**
 * Retry an async operation up to maxAttempts times with exponential backoff.
 * Only retries on transient errors (network, 5xx, 429). Permanent errors
 * (4xx except 429) are thrown immediately without wasting retries.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry permanent client errors (400, 401, 403, 404, etc.)
      if (err instanceof ClickUpApiError && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Get the ClickUp team ID for the workspace. The team ID is needed to create
 * spaces. We fetch teams and use the first one (most workspaces have one team).
 */
async function getTeamId(client: ClickUpClient): Promise<string> {
  const teams = await client.getTeams();
  if (teams.length === 0) {
    throw new Error("No ClickUp teams found for this workspace");
  }
  return teams[0].id;
}

/**
 * Create a list via the ClickUp API, including custom statuses.
 * The ClickUp API accepts statuses in the POST /folder/{id}/list body.
 */
async function createListWithStatuses(
  client: ClickUpClient,
  folderId: string,
  listPlan: ListPlan
): Promise<ClickUpList> {
  const body: Record<string, unknown> = {
    name: listPlan.name,
  };

  if (listPlan.description) {
    body.content = listPlan.description;
  }

  // Include custom statuses if defined
  if (listPlan.statuses && listPlan.statuses.length > 0) {
    body.statuses = listPlan.statuses.map((s, index) => ({
      status: s.name,
      color: s.color,
      type: s.type,
      orderindex: index,
    }));
  }

  return client.post<ClickUpList>(`/folder/${folderId}/list`, body);
}
