import { ClickUpClient } from "@/lib/clickup/client";
import { upsertCachedTasks, upsertCachedLists, upsertCachedFolders } from "@/lib/clickup/sync";
import type {
  ClickUpTask,
  ClickUpList,
  ClickUpFolder,
  CreateTaskParams,
  UpdateTaskParams,
} from "@/types/clickup";

// ---------------------------------------------------------------------------
// Result type for all write operations
// ---------------------------------------------------------------------------

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateRequired(value: unknown, name: string): void {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required`);
  }
}

function validateTaskId(taskId: string): void {
  validateRequired(taskId, "taskId");
  // ClickUp task IDs are alphanumeric strings
  if (!/^[a-zA-Z0-9]+$/.test(taskId)) {
    throw new Error(`Invalid task ID format: ${taskId}`);
  }
}

function validateListId(listId: string): void {
  validateRequired(listId, "listId");
}

function validatePriority(priority: number | undefined): void {
  if (priority !== undefined && (priority < 1 || priority > 4)) {
    throw new Error("Priority must be between 1 (urgent) and 4 (low)");
  }
}

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

export async function createTask(
  workspaceId: string,
  listId: string,
  params: CreateTaskParams
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateListId(listId);
    validateRequired(params.name, "name");
    validatePriority(params.priority);

    const client = new ClickUpClient(workspaceId);
    const task = await client.createTask(listId, params);

    // Update cache with new task
    await upsertCachedTasks(workspaceId, [task]);

    return { success: true, data: task };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

export async function updateTask(
  workspaceId: string,
  taskId: string,
  params: UpdateTaskParams
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validatePriority(params.priority);

    if (Object.keys(params).length === 0) {
      throw new Error("At least one field must be provided to update");
    }

    const client = new ClickUpClient(workspaceId);
    const task = await client.updateTask(taskId, params);

    // Update cache with modified task
    await upsertCachedTasks(workspaceId, [task]);

    return { success: true, data: task };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// moveTask
// ---------------------------------------------------------------------------

export async function moveTask(
  workspaceId: string,
  taskId: string,
  targetListId: string
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateListId(targetListId);

    const client = new ClickUpClient(workspaceId);

    // ClickUp move task API: POST /list/{list_id}/task/{task_id}
    const task = await client.post<ClickUpTask>(
      `/list/${targetListId}/task/${taskId}`
    );

    // Re-fetch the task to get updated list info
    const updatedTask = await client.getTask(taskId);
    await upsertCachedTasks(workspaceId, [updatedTask]);

    return { success: true, data: updatedTask };
  } catch (err) {
    // If the move endpoint isn't available, fall back to noting the error
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// updateTaskStatus
// ---------------------------------------------------------------------------

export async function updateTaskStatus(
  workspaceId: string,
  taskId: string,
  status: string
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(status, "status");

    return updateTask(workspaceId, taskId, { status });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// assignTask
// ---------------------------------------------------------------------------

export async function assignTask(
  workspaceId: string,
  taskId: string,
  assigneeIds: number[]
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);

    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      throw new Error("At least one assignee ID is required");
    }

    return updateTask(workspaceId, taskId, {
      assignees: { add: assigneeIds },
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// unassignTask
// ---------------------------------------------------------------------------

export async function unassignTask(
  workspaceId: string,
  taskId: string,
  assigneeIds: number[]
): Promise<OperationResult<ClickUpTask>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);

    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      throw new Error("At least one assignee ID is required");
    }

    return updateTask(workspaceId, taskId, {
      assignees: { rem: assigneeIds },
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------

export interface AddCommentResult {
  id: string;
  comment: Array<{ text: string }>;
  date: string;
}

export async function addComment(
  workspaceId: string,
  taskId: string,
  commentText: string,
  assigneeId?: number
): Promise<OperationResult<AddCommentResult>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(commentText, "commentText");

    const client = new ClickUpClient(workspaceId);

    const body: Record<string, unknown> = {
      comment_text: commentText,
    };

    if (assigneeId !== undefined) {
      body.assignee = assigneeId;
    }

    const result = await client.post<AddCommentResult>(
      `/task/${taskId}/comment`,
      body
    );

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// createList
// ---------------------------------------------------------------------------

export async function createList(
  workspaceId: string,
  folderId: string,
  name: string
): Promise<OperationResult<ClickUpList>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(folderId, "folderId");
    validateRequired(name, "name");

    const client = new ClickUpClient(workspaceId);
    const list = await client.createList(folderId, name);

    // Update cache with new list
    await upsertCachedLists(workspaceId, [list]);

    return { success: true, data: list };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// createFolder
// ---------------------------------------------------------------------------

export async function createFolder(
  workspaceId: string,
  spaceId: string,
  name: string
): Promise<OperationResult<ClickUpFolder>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(spaceId, "spaceId");
    validateRequired(name, "name");

    const client = new ClickUpClient(workspaceId);
    const folder = await client.createFolder(spaceId, name);

    // Update cache with new folder
    await upsertCachedFolders(workspaceId, [folder]);

    return { success: true, data: folder };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
