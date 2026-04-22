// ---------------------------------------------------------------------------
// B-075: Setup Execution Engine
// Automated creation of approved workspace items via ClickUp API.
// Creates Spaces, Folders, Lists in dependency order.
// NOTE: Statuses cannot be created via API - they are inherited from
// parent Spaces and must be configured manually by the user.
// ---------------------------------------------------------------------------

import { ClickUpClient, ClickUpApiError } from "@/lib/clickup/client";
import { upsertCachedSpaces, upsertCachedFolders, upsertCachedLists } from "@/lib/clickup/sync";
import { isItemTypeSupported, classifyClickUpError, getPlanCapabilities } from "@/lib/clickup/plan-capabilities";
import { runEnrichmentPhase } from "@/lib/setup/enrichment-phase";
import { logError, errorToMessage } from "@/lib/errors/log";
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
  /** Number of tasks in this item (for deletion warnings). Only set on deletion candidates. */
  taskCount?: number;
  /** AI recommendation for this item: 'keep' or 'delete' */
  recommendation?: 'keep' | 'delete';
  /** AI reasoning for the recommendation */
  recommendationReason?: string;
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
  planTier?: string,
  options?: { generateEnrichment?: boolean; userId?: string },
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
        markError(item, err, planTier);
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
          markError(item, err, planTier);
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
            const list = await withRetry(() => createListInFolder(client, folderId, listPlan));
            createdListIds.push(list.id);
            await upsertCachedLists(workspaceId, [list]);
            markSuccess(item, list.id);
          } catch (err) {
            markError(item, err, planTier);
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
          const list = await withRetry(() => createFolderlessList(client, spaceId, listPlan));
          createdListIds.push(list.id);
          await upsertCachedLists(workspaceId, [list]);
          markSuccess(item, list.id);
        } catch (err) {
          markError(item, err, planTier);
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
            markError(item, err, planTier);
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
            markError(item, err, planTier);
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
  // Smart skip: Goals require ClickUp Business+ plan. If the plan doesn't
  // support goals, skip them entirely with a helpful message instead of
  // wasting API calls that will fail.
  // Wrapped in outer try-catch so unexpected errors don't crash the build.
  // -------------------------------------------------------------------------
  if (plan.recommended_goals && plan.recommended_goals.length > 0) {
    // Smart skip: check plan capabilities before making any API calls
    if (planTier && !isItemTypeSupported('goal', planTier)) {
      const caps = getPlanCapabilities(planTier);
      for (const goal of plan.recommended_goals) {
        const item = findItem(items, "goal", goal.name);
        item.status = 'skipped';
        item.error = `Goals are not available on the ${caps.label} plan. Upgrade to Business or higher to use Goals.`;
        completed++;
        onProgress?.(item, { completed, total: totalItems });
      }
    } else {
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
              markError(item, err, planTier);
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
            markError(item, new Error('Goals phase encountered an unexpected error'));
            completed++;
            onProgress?.(item, { completed, total: totalItems });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Build final result
  // -------------------------------------------------------------------------
  const successCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const result: ExecutionResult = {
    success: errorCount === 0,
    totalItems,
    successCount,
    errorCount,
    items,
    createdSpaceIds,
    createdFolderIds,
    createdListIds,
  };

  // -------------------------------------------------------------------------
  // Phase 7: post-confirm enrichment (starter tasks + doc content via Haiku)
  // Intentionally silent - failures never affect the user-visible result.
  // -------------------------------------------------------------------------
  if (options?.generateEnrichment) {
    try {
      await runEnrichmentPhase({
        plan,
        executionResult: result,
        client,
        workspaceId,
        userId: options.userId,
      });
    } catch (enrichErr) {
      // Should never happen - enrichment swallows its own errors - but belt
      // and suspenders so no user flow is disrupted.
      await logError({
        source: 'setup.enrichment',
        errorCode: 'phase_crashed',
        message: errorToMessage(enrichErr),
        workspaceId,
        userId: options.userId,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reconciliation: delete items from previous builds that are no longer in plan
// ---------------------------------------------------------------------------

/**
 * Compute items that Binee previously created but are no longer in the new plan.
 * These are candidates for deletion (with user confirmation).
 *
 * Considers all buildable item types: spaces, folders, lists, tags, docs, goals.
 */
export function computeItemsToDelete(
  previouslyBuiltItems: ExecutionItem[],
  newPlan: SetupPlan,
): ExecutionItem[] {
  // Build a set of item keys from the new plan for fast lookup
  const newPlanKeys = new Set<string>();

  for (const space of newPlan.spaces) {
    newPlanKeys.add(itemKey('space', space.name));

    if (space.lists) {
      for (const list of space.lists) {
        newPlanKeys.add(itemKey('list', list.name, space.name));
      }
    }

    for (const folder of space.folders) {
      newPlanKeys.add(itemKey('folder', folder.name, space.name));
      for (const list of folder.lists) {
        newPlanKeys.add(itemKey('list', list.name, folder.name));
      }
    }
  }

  // Tags, docs, goals
  if (newPlan.recommended_tags) {
    for (const tag of newPlan.recommended_tags) {
      newPlanKeys.add(itemKey('tag', tag.name));
    }
  }
  if (newPlan.recommended_docs) {
    for (const doc of newPlan.recommended_docs) {
      newPlanKeys.add(itemKey('doc', doc.name));
    }
  }
  if (newPlan.recommended_goals) {
    for (const goal of newPlan.recommended_goals) {
      newPlanKeys.add(itemKey('goal', goal.name));
    }
  }

  // Find items that Binee created but are not in the new plan
  const toDelete: ExecutionItem[] = [];
  for (const item of previouslyBuiltItems) {
    if (!item.clickupId) continue;

    const key = itemKey(item.type, item.name, item.parentName);
    if (!newPlanKeys.has(key)) {
      toDelete.push(item);
    }
  }

  return toDelete;
}

/** Create a case-insensitive lookup key for plan items */
function itemKey(type: string, name: string, parentName?: string): string {
  const n = name.toLowerCase().trim();
  const p = parentName ? parentName.toLowerCase().trim() : '';
  return `${type}:${p}/${n}`;
}

// ---------------------------------------------------------------------------
// Reconciliation: find existing workspace items NOT in the proposed plan
// ---------------------------------------------------------------------------

/**
 * Compute existing workspace items (spaces, folders, lists) that are NOT in
 * the proposed plan. These are "extra" items occupying plan slots that the
 * user may want to delete to make room for new items.
 *
 * Excludes items already tracked in `previouslyBuiltItems` (those are handled
 * by `computeItemsToDelete` instead).
 */
export function computeExistingItemsNotInPlan(
  existingStructure: ExistingWorkspaceStructure | null | undefined,
  newPlan: SetupPlan,
  previouslyBuiltItems: ExecutionItem[],
): ExecutionItem[] {
  if (!existingStructure?.spaces || existingStructure.spaces.length === 0) return [];

  // Build set of plan item keys for fast lookup
  const planKeys = new Set<string>();
  for (const space of newPlan.spaces) {
    planKeys.add(itemKey('space', space.name));
    if (space.lists) {
      for (const list of space.lists) {
        planKeys.add(itemKey('list', list.name, space.name));
      }
    }
    for (const folder of space.folders) {
      planKeys.add(itemKey('folder', folder.name, space.name));
      for (const list of folder.lists) {
        planKeys.add(itemKey('list', list.name, folder.name));
      }
    }
  }
  // Include recommended docs in plan keys
  if (newPlan.recommended_docs) {
    for (const doc of newPlan.recommended_docs) {
      planKeys.add(itemKey('doc', doc.name));
    }
  }

  // Build set of previously-built clickup IDs so we don't double-count
  const builtIds = new Set(
    previouslyBuiltItems
      .filter(i => i.clickupId)
      .map(i => i.clickupId)
  );

  const extras: ExecutionItem[] = [];

  for (const space of existingStructure.spaces) {
    const spaceKey = itemKey('space', space.name);
    const isSpaceInPlan = planKeys.has(spaceKey);

    // Count tasks in this space (for deletion warning)
    let spaceTaskCount = 0;
    for (const folder of space.folders) {
      for (const list of folder.lists) {
        spaceTaskCount += list.task_count;
      }
    }
    for (const list of space.lists ?? []) {
      spaceTaskCount += list.task_count;
    }

    if (!isSpaceInPlan && !builtIds.has(space.clickup_id)) {
      extras.push({
        type: 'space',
        name: space.name,
        status: 'pending',
        clickupId: space.clickup_id,
        taskCount: spaceTaskCount,
      });
    }

    // Check folders
    for (const folder of space.folders) {
      const folderKey = itemKey('folder', folder.name, space.name);
      if (!planKeys.has(folderKey) && !builtIds.has(folder.clickup_id)) {
        let folderTaskCount = 0;
        for (const list of folder.lists) {
          folderTaskCount += list.task_count;
        }
        extras.push({
          type: 'folder',
          name: folder.name,
          parentName: space.name,
          status: 'pending',
          clickupId: folder.clickup_id,
          taskCount: folderTaskCount,
        });
      }

      // Check lists inside folders
      for (const list of folder.lists) {
        const listKey = itemKey('list', list.name, folder.name);
        if (!planKeys.has(listKey) && !builtIds.has(list.clickup_id)) {
          extras.push({
            type: 'list',
            name: list.name,
            parentName: folder.name,
            status: 'pending',
            clickupId: list.clickup_id,
            taskCount: list.task_count,
          });
        }
      }
    }

    // Check folderless lists
    for (const list of space.lists ?? []) {
      const listKey = itemKey('list', list.name, space.name);
      if (!planKeys.has(listKey) && !builtIds.has(list.clickup_id)) {
        extras.push({
          type: 'list',
          name: list.name,
          parentName: space.name,
          status: 'pending',
          clickupId: list.clickup_id,
          taskCount: list.task_count,
        });
      }
    }
  }

  // Check existing docs not in the plan
  if (existingStructure.docs) {
    for (const doc of existingStructure.docs) {
      const docKey = itemKey('doc', doc.name);
      if (!planKeys.has(docKey) && !builtIds.has(doc.clickup_id)) {
        extras.push({
          type: 'doc',
          name: doc.name,
          status: 'pending',
          clickupId: doc.clickup_id,
        });
      }
    }
  }

  return extras;
}

/**
 * Delete items from ClickUp that were created by Binee in a previous build
 * but are no longer in the current plan. Deletes in reverse dependency order:
 * tags/docs/goals first (no dependencies), then lists, folders, spaces.
 *
 * Returns execution items with the result of each deletion.
 */
export async function deleteRemovedItems(
  itemsToDelete: ExecutionItem[],
  workspaceId: string,
  onProgress?: ExecutionProgressCallback,
): Promise<ExecutionItem[]> {
  if (itemsToDelete.length === 0) return [];

  const client = new ClickUpClient(workspaceId);
  const results: ExecutionItem[] = [];
  let completed = 0;
  const total = itemsToDelete.length;

  // Sort: independent items first, then structural in reverse dependency order
  const typeOrder: Record<string, number> = { tag: 0, doc: 1, goal: 2, list: 3, folder: 4, space: 5 };
  const sorted = [...itemsToDelete].sort(
    (a, b) => (typeOrder[a.type] ?? 6) - (typeOrder[b.type] ?? 6)
  );

  for (const item of sorted) {
    const resultItem: ExecutionItem = {
      type: item.type,
      name: item.name,
      parentName: item.parentName,
      status: 'pending',
      clickupId: item.clickupId,
    };

    try {
      if (!item.clickupId) {
        resultItem.status = 'skipped';
        resultItem.error = 'No ClickUp ID available';
      } else {
        switch (item.type) {
          case 'tag':
            // For tags, clickupId stores the spaceId where the tag was created
            await withRetry(() => client.deleteTag(item.clickupId!, item.name));
            break;
          case 'doc':
            await withRetry(() => client.deleteDoc(item.clickupId!));
            break;
          case 'goal':
            await withRetry(() => client.deleteGoal(item.clickupId!));
            break;
          case 'list':
            await withRetry(() => client.deleteList(item.clickupId!));
            break;
          case 'folder':
            await withRetry(() => client.deleteFolder(item.clickupId!));
            break;
          case 'space':
            await withRetry(() => client.deleteSpace(item.clickupId!));
            break;
        }
        resultItem.status = 'success';
      }
    } catch (err) {
      resultItem.status = 'error';
      if (err instanceof ClickUpApiError && err.statusCode === 404) {
        // Already deleted - treat as success
        resultItem.status = 'success';
      } else {
        resultItem.error = err instanceof Error ? err.message : String(err);
      }
    }

    results.push(resultItem);
    completed++;
    onProgress?.(resultItem, { completed, total });
  }

  return results;
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

function markError(item: ExecutionItem, err: unknown, planTier?: string): void {
  item.status = "error";
  if (err instanceof ClickUpApiError) {
    // Pass the actual ClickUp response body for accurate error classification,
    // not the generic "ClickUp API error: 403 Forbidden" message
    const errorBody = typeof err.response === 'string'
      ? err.response
      : err.response
        ? JSON.stringify(err.response)
        : err.message;
    const classified = classifyClickUpError(
      err.statusCode,
      errorBody,
      item.type,
      planTier,
    );
    item.error = `${classified.message}. ${classified.detail}`;
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
 * Create a list inside a folder via the ClickUp API.
 *
 * NOTE: The ClickUp API does NOT support creating or modifying task statuses
 * programmatically. New lists inherit statuses from their parent Space/Folder.
 * Status recommendations from the plan are shown to the user as a post-build
 * manual setup step.
 */
async function createListInFolder(
  client: ClickUpClient,
  folderId: string,
  listPlan: ListPlan
): Promise<ClickUpList> {
  const body: Record<string, unknown> = { name: listPlan.name };
  if (listPlan.description) body.content = listPlan.description;

  return client.post<ClickUpList>(`/folder/${folderId}/list`, body);
}

/**
 * Create a folderless list directly in a space via the ClickUp API.
 *
 * Lists inherit statuses from the parent Space automatically.
 * Custom statuses must be configured manually in ClickUp.
 */
async function createFolderlessList(
  client: ClickUpClient,
  spaceId: string,
  listPlan: ListPlan
): Promise<ClickUpList> {
  const body: Record<string, unknown> = { name: listPlan.name };
  if (listPlan.description) body.content = listPlan.description;

  return client.post<ClickUpList>(`/space/${spaceId}/list`, body);
}
