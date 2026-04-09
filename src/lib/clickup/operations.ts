import { ClickUpClient } from "@/lib/clickup/client";
import { upsertCachedTasks, upsertCachedLists, upsertCachedFolders } from "@/lib/clickup/sync";
import type {
  ClickUpTask,
  ClickUpList,
  ClickUpFolder,
  ClickUpDoc,
  ClickUpDocPage,
  ClickUpComment,
  ClickUpGoal,
  ClickUpKeyResult,
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
    await client.post<ClickUpTask>(
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

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

export async function searchDocs(
  workspaceId: string
): Promise<OperationResult<ClickUpDoc[]>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    const client = new ClickUpClient(workspaceId);
    const docs = await client.searchDocs(workspaceId);
    return { success: true, data: docs };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createDoc(
  workspaceId: string,
  name: string,
  content?: string
): Promise<OperationResult<ClickUpDoc>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(name, "name");
    const client = new ClickUpClient(workspaceId);
    const doc = await client.createDoc(workspaceId, name, content);
    return { success: true, data: doc };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getDocPages(
  workspaceId: string,
  docId: string
): Promise<OperationResult<ClickUpDocPage[]>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(docId, "docId");
    const client = new ClickUpClient(workspaceId);
    const pages = await client.getDocPages(docId);
    return { success: true, data: pages };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createDocPage(
  workspaceId: string,
  docId: string,
  name: string,
  content?: string
): Promise<OperationResult<ClickUpDocPage>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(docId, "docId");
    validateRequired(name, "name");
    const client = new ClickUpClient(workspaceId);
    const page = await client.createDocPage(docId, name, content);
    return { success: true, data: page };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function updateDocPage(
  workspaceId: string,
  docId: string,
  pageId: string,
  params: { name?: string; content?: string }
): Promise<OperationResult<ClickUpDocPage>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(docId, "docId");
    validateRequired(pageId, "pageId");
    const client = new ClickUpClient(workspaceId);
    const page = await client.updateDocPage(docId, pageId, params);
    return { success: true, data: page };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function getTaskComments(
  workspaceId: string,
  taskId: string
): Promise<OperationResult<ClickUpComment[]>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    const client = new ClickUpClient(workspaceId);
    const comments = await client.getTaskComments(taskId);
    return { success: true, data: comments };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createTaskComment(
  workspaceId: string,
  taskId: string,
  commentText: string,
  assigneeId?: number
): Promise<OperationResult<ClickUpComment>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(commentText, "commentText");
    const client = new ClickUpClient(workspaceId);
    const comment = await client.createTaskComment(taskId, commentText, assigneeId);
    return { success: true, data: comment };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Goals & Key Results
// ---------------------------------------------------------------------------

export async function getGoals(
  workspaceId: string,
  teamId: string
): Promise<OperationResult<ClickUpGoal[]>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(teamId, "teamId");
    const client = new ClickUpClient(workspaceId);
    const goals = await client.getGoals(teamId);
    return { success: true, data: goals };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createGoal(
  workspaceId: string,
  teamId: string,
  params: {
    name: string;
    due_date: string;
    description?: string;
    multiple_owners?: boolean;
    owners?: number[];
    color?: string;
  }
): Promise<OperationResult<ClickUpGoal>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(teamId, "teamId");
    validateRequired(params.name, "name");
    validateRequired(params.due_date, "due_date");
    const client = new ClickUpClient(workspaceId);
    const goal = await client.createGoal(teamId, params);
    return { success: true, data: goal };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function updateGoal(
  workspaceId: string,
  goalId: string,
  params: {
    name?: string;
    due_date?: string;
    description?: string;
    color?: string;
  }
): Promise<OperationResult<ClickUpGoal>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(goalId, "goalId");
    const client = new ClickUpClient(workspaceId);
    const goal = await client.updateGoal(goalId, params);
    return { success: true, data: goal };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getKeyResults(
  workspaceId: string,
  goalId: string
): Promise<OperationResult<ClickUpKeyResult[]>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(goalId, "goalId");
    const client = new ClickUpClient(workspaceId);
    const keyResults = await client.getKeyResults(goalId);
    return { success: true, data: keyResults };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createKeyResult(
  workspaceId: string,
  goalId: string,
  params: {
    name: string;
    type: string;
    steps_start: number;
    steps_end: number;
    unit?: string;
    owners?: number[];
  }
): Promise<OperationResult<ClickUpKeyResult>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateRequired(goalId, "goalId");
    validateRequired(params.name, "name");
    const client = new ClickUpClient(workspaceId);
    const keyResult = await client.createKeyResult(goalId, params);
    return { success: true, data: keyResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function addTagToTask(
  workspaceId: string,
  taskId: string,
  tagName: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(tagName, "tagName");
    const client = new ClickUpClient(workspaceId);
    await client.addTagToTask(taskId, tagName);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function removeTagFromTask(
  workspaceId: string,
  taskId: string,
  tagName: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(tagName, "tagName");
    const client = new ClickUpClient(workspaceId);
    await client.removeTagFromTask(taskId, tagName);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Custom Fields
// ---------------------------------------------------------------------------

export async function setCustomFieldValue(
  workspaceId: string,
  taskId: string,
  fieldId: string,
  value: unknown
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateRequired(fieldId, "fieldId");
    const client = new ClickUpClient(workspaceId);
    await client.setCustomFieldValue(taskId, fieldId, value);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Dependencies & Task Links
// ---------------------------------------------------------------------------

export async function addDependency(
  workspaceId: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateTaskId(dependsOnTaskId);
    const client = new ClickUpClient(workspaceId);
    await client.addDependency(taskId, dependsOnTaskId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function removeDependency(
  workspaceId: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateTaskId(dependsOnTaskId);
    const client = new ClickUpClient(workspaceId);
    await client.removeDependency(taskId, dependsOnTaskId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function addTaskLink(
  workspaceId: string,
  taskId: string,
  linksToTaskId: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateTaskId(linksToTaskId);
    const client = new ClickUpClient(workspaceId);
    await client.addTaskLink(taskId, linksToTaskId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function removeTaskLink(
  workspaceId: string,
  taskId: string,
  linksToTaskId: string
): Promise<OperationResult<void>> {
  try {
    validateRequired(workspaceId, "workspaceId");
    validateTaskId(taskId);
    validateTaskId(linksToTaskId);
    const client = new ClickUpClient(workspaceId);
    await client.removeTaskLink(taskId, linksToTaskId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
