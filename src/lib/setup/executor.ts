// ---------------------------------------------------------------------------
// B-075: Setup Execution Engine
// Automated creation of approved workspace items via ClickUp API.
// Creates Spaces, Folders, Lists, Statuses in dependency order.
// ---------------------------------------------------------------------------

import { ClickUpClient, ClickUpApiError } from "@/lib/clickup/client";
import { upsertCachedSpaces, upsertCachedFolders, upsertCachedLists } from "@/lib/clickup/sync";
import type { ClickUpList } from "@/types/clickup";
import type { SetupPlan, ListPlan } from "@/lib/setup/types";
import type { ExistingWorkspaceStructure } from "@/stores/setupStore";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ExecutionItemStatus = "pending" | "success" | "error" | "skipped";

export type ExecutionItemType = "space" | "folder" | "list" | "tag" | "doc" | "goal";

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
  const existingSpaces = new Map<string, {
    clickup_id: string;
    folders: Map<string, { clickup_id: string; lists: Set<string> }>;
    folderlessLists: Set<string>;
  }>();
  if (existingStructure?.spaces) {
    for (const space of existingStructure.spaces) {
      const folderMap = new Map<string, { clickup_id: string; lists: Set<string> }>();
      for (const folder of space.folders) {
        const listNames = new Set(folder.lists.map((l) => l.name.toLowerCase()));
        folderMap.set(folder.name.toLowerCase(), { clickup_id: folder.clickup_id, lists: listNames });
      }
      const folderlessLists = new Set(
        (space.lists ?? []).map((l) => l.name.toLowerCase())
      );
      existingSpaces.set(space.name.toLowerCase(), {
        clickup_id: space.clickup_id,
        folders: folderMap,
        folderlessLists,
      });
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

  // We need the ClickUp team ID to create spaces.
  // If this fails (token expired, no teams), the entire build cannot proceed.
  let teamId: string;
  try {
    teamId = await getTeamId(client);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to connect to ClickUp';
    console.error('[setup/executor] getTeamId failed:', err);
    // Mark all items as errored and return immediately
    for (const item of items) {
      item.status = 'error';
      item.error = `ClickUp connection failed: ${errorMsg}`;
    }
    return {
      success: false,
      totalItems,
      successCount: 0,
      errorCount: totalItems,
      items,
      createdSpaceIds: [],
      createdFolderIds: [],
      createdListIds: [],
    };
  }

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
  // Phase 3a: Create Lists inside Folders (or skip if they already exist)
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
  // Phase 3b: Create Folderless Lists (directly in spaces)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    if (!spacePlan.lists?.length) continue;

    const spaceId = spaceIdMap.get(spacePlan.name);
    const existingSpace = existingSpaces.get(spacePlan.name.toLowerCase());
    const existingFolderlessLists = existingSpace?.folderlessLists ?? new Set<string>();

    for (const listPlan of spacePlan.lists) {
      const item = findItem(items, "list", listPlan.name, spacePlan.name);

      if (!spaceId) {
        markError(item, new Error(`Skipped: parent space "${spacePlan.name}" was not created`));
        completed++;
        onProgress?.(item, { completed, total: totalItems });
        continue;
      }

      if (existingFolderlessLists.has(listPlan.name.toLowerCase())) {
        markSkipped(item);
      } else {
        try {
          const list = await withRetry(() => createFolderlessListWithStatuses(client, spaceId, listPlan));
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

  // -------------------------------------------------------------------------
  // Phase 4: Create Tags (in the first space that has an ID)
  // Wrapped in outer try-catch so unexpected errors don't crash the build.
  // -------------------------------------------------------------------------
  if (plan.recommended_tags && plan.recommended_tags.length > 0) {
    try {
      const firstSpaceId = createdSpaceIds[0] || spaceIdMap.values().next().value;

      // Fetch existing tags for duplicate detection (safe for retry)
      let existingTagNames = new Set<string>();
      if (firstSpaceId) {
        try {
          const existingTags = await client.getSpaceTags(firstSpaceId);
          existingTagNames = new Set(existingTags.map(t => t.name.toLowerCase()));
        } catch {
          // If we can't fetch tags, proceed without duplicate check
        }
      }

      for (const tag of plan.recommended_tags) {
        const item = findItem(items, "tag", tag.name);

        if (!firstSpaceId) {
          markError(item, new Error("No space available to create tags in"));
        } else if (existingTagNames.has(tag.name.toLowerCase())) {
          markSkipped(item, firstSpaceId);
        } else {
          try {
            await withRetry(() =>
              client.post(`/space/${firstSpaceId}/tag`, {
                tag: { name: tag.name, tag_bg: tag.tag_bg, tag_fg: tag.tag_fg },
              })
            );
            markSuccess(item, firstSpaceId);
          } catch (err) {
            markError(item, err);
            console.error(`[setup/executor] Failed to create tag "${tag.name}":`, err);
          }
        }

        completed++;
        onProgress?.(item, { completed, total: totalItems });
      }
    } catch (phaseErr) {
      console.error('[setup/executor] Tags phase failed unexpectedly:', phaseErr);
      // Mark any remaining pending tag items as errors
      for (const tag of plan.recommended_tags) {
        const item = items.find(i => i.type === 'tag' && i.name === tag.name && i.status === 'pending');
        if (item) {
          markError(item, new Error('Tags phase encountered an unexpected error'));
          completed++;
          onProgress?.(item, { completed, total: totalItems });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5: Create Docs (uses ClickUp API v3)
  // Wrapped in outer try-catch so unexpected errors don't crash the build.
  // -------------------------------------------------------------------------
  if (plan.recommended_docs && plan.recommended_docs.length > 0) {
    try {
      const firstSpaceId = createdSpaceIds[0] || spaceIdMap.values().next().value;

      // Fetch existing docs for duplicate detection (safe for retry)
      let existingDocNames = new Set<string>();
      try {
        const existingDocs = await client.searchDocs(teamId);
        existingDocNames = new Set(existingDocs.map(d => d.name.toLowerCase()));
      } catch {
        // If we can't fetch docs, proceed without duplicate check
      }

      for (const doc of plan.recommended_docs) {
        const item = findItem(items, "doc", doc.name);

        if (!firstSpaceId) {
          markError(item, new Error("No space available to create docs in"));
        } else if (existingDocNames.has(doc.name.toLowerCase())) {
          markSkipped(item);
        } else {
          try {
            // Try ClickUp v3 Docs API first, fall back to v2 if unavailable
            let docId: string | undefined;
            try {
              const body: Record<string, unknown> = {
                name: doc.name,
                parent: { id: firstSpaceId, type: 4 }, // 4 = space
              };
              const v3Result = await withRetry(() =>
                client.postV3<{ id?: string }>(`/workspaces/${teamId}/docs`, body)
              );
              docId = v3Result?.id;
            } catch {
              // v3 failed (might not be available on this plan), try v2
              try {
                const v2Result = await withRetry(() =>
                  client.post<{ id?: string }>(`/team/${teamId}/doc`, {
                    name: doc.name,
                    content: doc.description || '',
                  })
                );
                docId = v2Result?.id;
              } catch (v2Err) {
                throw v2Err; // Let the outer per-item catch handle it
              }
            }
            markSuccess(item, docId || firstSpaceId);
          } catch (err) {
            markError(item, err);
            console.error(`[setup/executor] Failed to create doc "${doc.name}":`, err);
          }
        }

        completed++;
        onProgress?.(item, { completed, total: totalItems });
      }
    } catch (phaseErr) {
      console.error('[setup/executor] Docs phase failed unexpectedly:', phaseErr);
      for (const doc of plan.recommended_docs) {
        const item = items.find(i => i.type === 'doc' && i.name === doc.name && i.status === 'pending');
        if (item) {
          markError(item, new Error('Docs phase encountered an unexpected error'));
          completed++;
          onProgress?.(item, { completed, total: totalItems });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 6: Create Goals
  // Note: Goals API requires ClickUp Business+ plan. On Free/Unlimited plans
  // these will fail gracefully and be reported as errors (non-blocking).
  // Wrapped in outer try-catch so unexpected errors don't crash the build.
  // -------------------------------------------------------------------------
  if (plan.recommended_goals && plan.recommended_goals.length > 0) {
    try {
      // Fetch existing goals for duplicate detection (safe for retry)
      let existingGoalNames = new Set<string>();
      try {
        const existingGoals = await client.getGoals(teamId);
        existingGoalNames = new Set(existingGoals.map(g => g.name.toLowerCase()));
      } catch {
        // If we can't fetch goals (e.g. plan doesn't support it), proceed
      }

      for (const goal of plan.recommended_goals) {
        const item = findItem(items, "goal", goal.name);

        if (existingGoalNames.has(goal.name.toLowerCase())) {
          markSkipped(item);
        } else {
          try {
            const dueMs = goal.due_date ? new Date(goal.due_date).getTime() : undefined;
            const body: Record<string, unknown> = {
              name: goal.name,
            };
            // Only set due_date if we have a valid timestamp
            if (dueMs && !isNaN(dueMs)) body.due_date = dueMs;
            if (goal.description) body.description = goal.description;
            if (goal.color) body.color = goal.color;
            const result = await withRetry(() =>
              client.post<{ goal?: { id?: string } }>(`/team/${teamId}/goal`, body)
            );
            markSuccess(item, result?.goal?.id || teamId);
          } catch (err) {
            markError(item, err);
            console.error(`[setup/executor] Failed to create goal "${goal.name}":`, err);
          }
        }

        completed++;
        onProgress?.(item, { completed, total: totalItems });
      }
    } catch (phaseErr) {
      console.error('[setup/executor] Goals phase failed unexpectedly:', phaseErr);
      for (const goal of plan.recommended_goals) {
        const item = items.find(i => i.type === 'goal' && i.name === goal.name && i.status === 'pending');
        if (item) {
          markError(item, new Error('Goals require ClickUp Business+ plan'));
          completed++;
          onProgress?.(item, { completed, total: totalItems });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Build final result
  // -------------------------------------------------------------------------
  const successCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;

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

    // Folderless lists (directly in space)
    if (space.lists) {
      for (const list of space.lists) {
        items.push({
          type: "list",
          name: list.name,
          parentName: space.name,
          status: "pending",
        });
      }
    }

    // Folders and their lists
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

  // Tags
  if (plan.recommended_tags) {
    for (const tag of plan.recommended_tags) {
      items.push({ type: "tag", name: tag.name, status: "pending" });
    }
  }

  // Docs
  if (plan.recommended_docs) {
    for (const doc of plan.recommended_docs) {
      items.push({ type: "doc", name: doc.name, status: "pending" });
    }
  }

  // Goals
  if (plan.recommended_goals) {
    for (const goal of plan.recommended_goals) {
      items.push({ type: "goal", name: goal.name, status: "pending" });
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
    item.error = `Not allowed by ClickUp. Your plan may limit ${item.type} creation.`;
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
 * Build the list creation body (shared between folder-based and folderless).
 */
function buildListBody(listPlan: ListPlan): Record<string, unknown> {
  const body: Record<string, unknown> = { name: listPlan.name };
  if (listPlan.description) body.content = listPlan.description;
  if (listPlan.statuses && listPlan.statuses.length > 0) {
    body.statuses = listPlan.statuses.map((s, index) => ({
      status: s.name,
      color: s.color,
      // ClickUp API expects 'custom' for active/in-progress statuses, not 'active'
      type: s.type === 'active' ? 'custom' : s.type,
      orderindex: index,
    }));
  }
  return body;
}

/**
 * Create a list inside a folder via the ClickUp API, including custom statuses.
 */
async function createListWithStatuses(
  client: ClickUpClient,
  folderId: string,
  listPlan: ListPlan
): Promise<ClickUpList> {
  return client.post<ClickUpList>(`/folder/${folderId}/list`, buildListBody(listPlan));
}

/**
 * Create a folderless list directly in a space via the ClickUp API.
 */
async function createFolderlessListWithStatuses(
  client: ClickUpClient,
  spaceId: string,
  listPlan: ListPlan
): Promise<ClickUpList> {
  return client.post<ClickUpList>(`/space/${spaceId}/list`, buildListBody(listPlan));
}
