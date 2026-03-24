// ---------------------------------------------------------------------------
// B-075: Setup Execution Engine
// Automated creation of approved workspace items via ClickUp API.
// Creates Spaces, Folders, Lists, Statuses in dependency order.
// ---------------------------------------------------------------------------

import { ClickUpClient } from "@/lib/clickup/client";
import { upsertCachedSpaces, upsertCachedFolders, upsertCachedLists } from "@/lib/clickup/sync";
import type { ClickUpSpace, ClickUpFolder, ClickUpList } from "@/types/clickup";
import type { SetupPlan, SpacePlan, FolderPlan, ListPlan } from "@/lib/setup/types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ExecutionItemStatus = "pending" | "success" | "error";

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
  onProgress?: ExecutionProgressCallback
): Promise<ExecutionResult> {
  const client = new ClickUpClient(workspaceId);

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
  // Phase 1: Create Spaces
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    const item = findItem(items, "space", spacePlan.name);
    try {
      const space = await client.createSpace(teamId, spacePlan.name);
      spaceIdMap.set(spacePlan.name, space.id);
      createdSpaceIds.push(space.id);

      // Cache the new space
      await upsertCachedSpaces(workspaceId, [space]);

      markSuccess(item, space.id);
    } catch (err) {
      markError(item, err);
    }

    completed++;
    onProgress?.(item, { completed, total: totalItems });
  }

  // -------------------------------------------------------------------------
  // Phase 2: Create Folders (within their parent spaces)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    const spaceId = spaceIdMap.get(spacePlan.name);

    for (const folderPlan of spacePlan.folders) {
      const item = findItem(items, "folder", folderPlan.name, spacePlan.name);

      if (!spaceId) {
        markError(item, new Error(`Skipped: parent space "${spacePlan.name}" was not created`));
        completed++;
        onProgress?.(item, { completed, total: totalItems });
        continue;
      }

      try {
        const folder = await client.createFolder(spaceId, folderPlan.name);
        const folderKey = `${spacePlan.name}/${folderPlan.name}`;
        folderIdMap.set(folderKey, folder.id);
        createdFolderIds.push(folder.id);

        await upsertCachedFolders(workspaceId, [folder]);

        markSuccess(item, folder.id);
      } catch (err) {
        markError(item, err);
      }

      completed++;
      onProgress?.(item, { completed, total: totalItems });
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3: Create Lists with Statuses (within their parent folders)
  // -------------------------------------------------------------------------
  for (const spacePlan of plan.spaces) {
    for (const folderPlan of spacePlan.folders) {
      const folderKey = `${spacePlan.name}/${folderPlan.name}`;
      const folderId = folderIdMap.get(folderKey);

      for (const listPlan of folderPlan.lists) {
        const item = findItem(items, "list", listPlan.name, folderPlan.name);

        if (!folderId) {
          markError(item, new Error(`Skipped: parent folder "${folderPlan.name}" was not created`));
          completed++;
          onProgress?.(item, { completed, total: totalItems });
          continue;
        }

        try {
          const list = await createListWithStatuses(client, folderId, listPlan);
          createdListIds.push(list.id);

          await upsertCachedLists(workspaceId, [list]);

          markSuccess(item, list.id);
        } catch (err) {
          markError(item, err);
        }

        completed++;
        onProgress?.(item, { completed, total: totalItems });
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
  item.error = err instanceof Error ? err.message : String(err);
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
