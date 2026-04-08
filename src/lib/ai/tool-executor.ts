import { createClient } from '@supabase/supabase-js';
import {
  createTask as clickupCreateTask,
  updateTask as clickupUpdateTask,
  assignTask as clickupAssignTask,
  unassignTask as clickupUnassignTask,
  moveTask as clickupMoveTask,
  searchDocs as clickupSearchDocs,
  createDoc as clickupCreateDoc,
  getDocPages as clickupGetDocPages,
  createDocPage as clickupCreateDocPage,
  updateDocPage as clickupUpdateDocPage,
  getGoals as clickupGetGoals,
  createGoal as clickupCreateGoal,
  updateGoal as clickupUpdateGoal,
  getKeyResults as clickupGetKeyResults,
  createKeyResult as clickupCreateKeyResult,
  getTaskComments as clickupGetTaskComments,
  createTaskComment as clickupCreateTaskComment,
  addTagToTask as clickupAddTagToTask,
  removeTagFromTask as clickupRemoveTagFromTask,
  setCustomFieldValue as clickupSetCustomFieldValue,
  addDependency as clickupAddDependency,
  removeDependency as clickupRemoveDependency,
  addTaskLink as clickupAddTaskLink,
  removeTaskLink as clickupRemoveTaskLink,
} from '@/lib/clickup/operations';
import { ClickUpClient } from '@/lib/clickup/client';
import type { CreateTaskParams, UpdateTaskParams } from '@/types/clickup';


// ---------------------------------------------------------------------------
// Supabase admin client (server-side only)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  return createClient(url, serviceKey);
}

// ---------------------------------------------------------------------------
// Main tool executor — routes to the correct handler
// ---------------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  try {
    switch (toolName) {
      case 'lookup_tasks':
        return await handleLookupTasks(toolInput, workspaceId);
      case 'update_task':
        return await handleUpdateTask(toolInput, workspaceId);
      case 'create_task':
        return await handleCreateTask(toolInput, workspaceId);
      case 'get_overdue_tasks':
        return await handleGetOverdueTasks(toolInput, workspaceId);
      case 'assign_task':
        return await handleAssignTask(toolInput, workspaceId);
      case 'move_task':
        return await handleMoveTask(toolInput, workspaceId);
      case 'get_workspace_summary':
        return await handleGetWorkspaceSummary(workspaceId);
      case 'get_weekly_summary':
        return await handleGetWeeklySummary(toolInput, workspaceId);
      case 'get_team_activity':
        return await handleGetTeamActivity(toolInput, workspaceId);
      case 'get_time_tracking_summary':
        return await handleGetTimeTrackingSummary(toolInput, workspaceId);
      case 'get_workspace_health':
        return await handleGetWorkspaceHealth(workspaceId);
      // Time tracking actions
      case 'start_time_tracking':
        return await handleStartTimeTracking(toolInput, workspaceId);
      case 'stop_time_tracking':
        return await handleStopTimeTracking(workspaceId);
      case 'add_manual_time_entry':
        return await handleAddManualTimeEntry(toolInput, workspaceId);
      // Docs
      case 'search_docs':
        return await handleSearchDocs(workspaceId);
      case 'get_doc_pages':
        return await handleGetDocPages(toolInput, workspaceId);
      case 'create_doc':
        return await handleCreateDoc(toolInput, workspaceId);
      case 'create_doc_page':
        return await handleCreateDocPage(toolInput, workspaceId);
      case 'update_doc_page':
        return await handleUpdateDocPage(toolInput, workspaceId);
      // Goals & Key Results
      case 'get_goals':
        return await handleGetGoals(workspaceId);
      case 'create_goal':
        return await handleCreateGoal(toolInput, workspaceId);
      case 'update_goal':
        return await handleUpdateGoal(toolInput, workspaceId);
      case 'get_key_results':
        return await handleGetKeyResults(toolInput, workspaceId);
      case 'create_key_result':
        return await handleCreateKeyResult(toolInput, workspaceId);
      // Comments
      case 'get_task_comments':
        return await handleGetTaskComments(toolInput, workspaceId);
      case 'add_task_comment':
        return await handleAddTaskComment(toolInput, workspaceId);
      // Tags
      case 'get_tags':
        return await handleGetTags(workspaceId);
      case 'add_tag_to_task':
        return await handleAddTagToTask(toolInput, workspaceId);
      case 'remove_tag_from_task':
        return await handleRemoveTagFromTask(toolInput, workspaceId);
      // Custom Fields
      case 'set_custom_field':
        return await handleSetCustomField(toolInput, workspaceId);
      // Dependencies & Links
      case 'add_dependency':
        return await handleAddDependency(toolInput, workspaceId);
      case 'remove_dependency':
        return await handleRemoveDependency(toolInput, workspaceId);
      case 'add_task_link':
        return await handleAddTaskLink(toolInput, workspaceId);
      case 'remove_task_link':
        return await handleRemoveTaskLink(toolInput, workspaceId);
      // Batch operations
      case 'batch_create_tasks':
        return await handleBatchCreateTasks(toolInput, workspaceId);
      // File content attachment
      case 'attach_file_content_to_task':
        return await handleAttachFileContentToTask(toolInput, workspaceId);
      default:
        return { error: `Unknown tool: ${toolName}`, success: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message, success: false };
  }
}

// ---------------------------------------------------------------------------
// Helper: enrich task rows with list names for better AI responses
// ---------------------------------------------------------------------------

async function enrichWithListNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  tasks: Array<{ clickup_id: string; name: string; status: string | null; assignees: unknown; due_date: string | null; priority: number | null; list_id: string }>,
): Promise<Record<string, unknown>> {
  const listIds = [...new Set(tasks.map((t) => t.list_id))];
  const { data: lists } = await supabase
    .from('cached_lists')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId)
    .in('clickup_id', listIds);

  const listMap = new Map((lists ?? []).map((l: { clickup_id: string; name: string }) => [l.clickup_id, l.name]));

  return {
    success: true,
    tasks: tasks.map((t) => ({
      id: t.clickup_id,
      name: t.name,
      status: t.status,
      assignees: Array.isArray(t.assignees) ? t.assignees.map((a: { username?: string }) => a.username).filter(Boolean) : [],
      due_date: t.due_date,
      priority: t.priority,
      list: listMap.get(t.list_id) ?? t.list_id,
    })),
    count: tasks.length,
  };
}

// ---------------------------------------------------------------------------
// lookup_tasks — queries cached_tasks using correct schema columns
// ---------------------------------------------------------------------------

async function handleLookupTasks(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  // Schema columns: clickup_id, name, status, assignees (jsonb), due_date, priority, list_id, description
  let query = supabase
    .from('cached_tasks')
    .select('clickup_id, name, status, assignees, due_date, priority, list_id, description')
    .eq('workspace_id', workspaceId);

  // Filter by assignee name (search inside the jsonb assignees array)
  if (input.assignee && typeof input.assignee === 'string') {
    // Assignees is a jsonb array of objects with username field
    query = query.contains('assignees', [{ username: input.assignee }]);
  }

  if (input.status && typeof input.status === 'string') {
    query = query.ilike('status', `%${input.status}%`);
  }

  if (input.list_name && typeof input.list_name === 'string') {
    // Look up the list_id from cached_lists first
    const { data: matchingLists } = await supabase
      .from('cached_lists')
      .select('clickup_id, name')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${input.list_name}%`);

    if (matchingLists && matchingLists.length > 0) {
      const listIds = matchingLists.map((l) => l.clickup_id);
      query = query.in('list_id', listIds);
    } else {
      return { success: true, tasks: [], count: 0, message: `No lists found matching "${input.list_name}"` };
    }
  }

  if (input.due_before && typeof input.due_before === 'string') {
    query = query.lt('due_date', input.due_before);
  }

  if (input.due_after && typeof input.due_after === 'string') {
    query = query.gt('due_date', input.due_after);
  }

  if (input.overdue === true) {
    const now = new Date().toISOString();
    query = query
      .lt('due_date', now)
      .not('status', 'ilike', '%closed%')
      .not('status', 'ilike', '%complete%');
  }

  const searchQuery = (input.query && typeof input.query === 'string') ? input.query : null;

  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
    );
  }

  const limit = Math.min(
    typeof input.limit === 'number' ? input.limit : 20,
    50,
  );
  query = query.limit(limit).order('due_date', { ascending: true, nullsFirst: false });

  const { data: tasks, error } = await query;

  if (error) {
    return { error: `Failed to query tasks: ${error.message}`, success: false };
  }

  // Enrich tasks with list names for better AI responses
  const enrichedTasks = tasks ?? [];
  if (enrichedTasks.length > 0) {
    return enrichWithListNames(supabase, workspaceId, enrichedTasks);
  }

  // --- Fuzzy fallback: if exact search returned nothing, try keyword search ---
  // Split the query into significant keywords and search for each individually.
  // This handles typos, wrong verbs, partial recall — e.g. user says "build a
  // website" but the task is "update website", we'd match on "website".
  if (searchQuery && searchQuery.length > 3) {
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'like',
      'and', 'or', 'but', 'not', 'no', 'so', 'if', 'then', 'than', 'that',
      'this', 'it', 'its', 'my', 'me', 'we', 'our', 'your', 'his', 'her',
      'their', 'them', 'find', 'show', 'get', 'tell', 'give', 'task', 'tasks',
    ]);

    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    if (keywords.length > 0) {
      // Build OR conditions for each keyword against name
      const keywordConditions = keywords
        .map((kw) => `name.ilike.%${kw}%`)
        .join(',');

      const { data: fuzzyTasks } = await supabase
        .from('cached_tasks')
        .select('clickup_id, name, status, assignees, due_date, priority, list_id, description')
        .eq('workspace_id', workspaceId)
        .or(keywordConditions)
        .limit(10)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (fuzzyTasks && fuzzyTasks.length > 0) {
        const result = await enrichWithListNames(supabase, workspaceId, fuzzyTasks);
        return {
          ...result,
          fuzzy_match: true,
          message: `No exact match for "${searchQuery}", but found ${fuzzyTasks.length} task(s) with similar keywords. These might be what you're looking for.`,
        };
      }
    }
  }

  return { success: true, tasks: [], count: 0 };
}

// ---------------------------------------------------------------------------
// update_task
// ---------------------------------------------------------------------------

async function handleUpdateTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }

  const supabase = getSupabaseAdmin();
  const updateParams: UpdateTaskParams = {};

  if (input.status && typeof input.status === 'string') {
    updateParams.status = input.status;
  }

  if (input.priority && typeof input.priority === 'number') {
    updateParams.priority = input.priority;
  }

  if (input.due_date && typeof input.due_date === 'string') {
    updateParams.due_date = new Date(input.due_date).getTime();
  }

  // Resolve assignee name to ClickUp user ID
  if (input.assignee_name && typeof input.assignee_name === 'string') {
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.assignee_name}%`)
      .limit(1)
      .single();

    if (member) {
      updateParams.assignees = { add: [parseInt(member.clickup_id)] };
    } else {
      return {
        error: `Could not find team member matching "${input.assignee_name}"`,
        success: false,
      };
    }
  }

  // Use B-035 operations wrapper — handles validation, API call, and cache sync
  const result = await clickupUpdateTask(workspaceId, taskId, updateParams);

  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to update task', success: false };
  }

  const updatedTask = result.data;
  return {
    success: true,
    task: {
      id: updatedTask.id,
      name: updatedTask.name,
      status: updatedTask.status.status,
      assignees: updatedTask.assignees.map((a) => a.username),
    },
    message: `Task "${updatedTask.name}" updated successfully.`,
  };
}

// ---------------------------------------------------------------------------
// create_task
// ---------------------------------------------------------------------------

async function handleCreateTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const listName = input.list_name as string;
  const taskName = input.name as string;

  if (!listName || !taskName) {
    return { error: 'list_name and name are required', success: false };
  }

  const supabase = getSupabaseAdmin();

  // Resolve list name to ClickUp list ID
  const { data: list } = await supabase
    .from('cached_lists')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${listName}%`)
    .limit(1)
    .single();

  if (!list) {
    return {
      error: `Could not find a list matching "${listName}". Available lists can be found with a workspace health check.`,
      success: false,
    };
  }

  const createParams: CreateTaskParams = { name: taskName };

  if (input.description && typeof input.description === 'string') {
    createParams.description = input.description;
  }
  if (input.status && typeof input.status === 'string') {
    createParams.status = input.status;
  }
  if (input.priority && typeof input.priority === 'number') {
    createParams.priority = input.priority;
  }
  if (input.due_date && typeof input.due_date === 'string') {
    createParams.due_date = new Date(input.due_date).getTime();
  }

  // Resolve assignee
  if (input.assignee_name && typeof input.assignee_name === 'string') {
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.assignee_name}%`)
      .limit(1)
      .single();

    if (member) {
      createParams.assignees = [parseInt(member.clickup_id)];
    }
  }

  // Use B-035 operations wrapper — handles validation, API call, and cache sync
  const result = await clickupCreateTask(workspaceId, list.clickup_id, createParams);

  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to create task', success: false };
  }

  const createdTask = result.data;
  return {
    success: true,
    task: {
      id: createdTask.id,
      name: createdTask.name,
      list: list.name,
      status: createdTask.status.status,
    },
    message: `Task "${createdTask.name}" created in list "${list.name}".`,
  };
}

// ---------------------------------------------------------------------------
// get_overdue_tasks — dedicated overdue tasks retrieval
// ---------------------------------------------------------------------------

async function handleGetOverdueTasks(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from('cached_tasks')
    .select('clickup_id, name, status, assignees, due_date, priority, list_id')
    .eq('workspace_id', workspaceId)
    .lt('due_date', now)
    .not('status', 'ilike', '%closed%')
    .not('status', 'ilike', '%complete%')
    .not('due_date', 'is', null);

  // Filter by assignee
  if (input.assignee && typeof input.assignee === 'string') {
    query = query.contains('assignees', [{ username: input.assignee }]);
  }

  // Filter by list name
  if (input.list_name && typeof input.list_name === 'string') {
    const { data: matchingLists } = await supabase
      .from('cached_lists')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${input.list_name}%`);

    if (matchingLists && matchingLists.length > 0) {
      query = query.in('list_id', matchingLists.map((l) => l.clickup_id));
    } else {
      return { success: true, tasks: [], count: 0, message: `No lists found matching "${input.list_name}"` };
    }
  }

  const limit = Math.min(
    typeof input.limit === 'number' ? input.limit : 25,
    50,
  );
  query = query.limit(limit).order('due_date', { ascending: true });

  const { data: tasks, error } = await query;

  if (error) {
    return { error: `Failed to query overdue tasks: ${error.message}`, success: false };
  }

  const overdueTasks = tasks ?? [];

  // Enrich with list names and days overdue
  if (overdueTasks.length > 0) {
    const listIds = [...new Set(overdueTasks.map((t) => t.list_id))];
    const { data: lists } = await supabase
      .from('cached_lists')
      .select('clickup_id, name')
      .eq('workspace_id', workspaceId)
      .in('clickup_id', listIds);

    const listMap = new Map((lists ?? []).map((l) => [l.clickup_id, l.name]));
    const nowMs = Date.now();

    return {
      success: true,
      tasks: overdueTasks.map((t) => {
        const dueMs = new Date(t.due_date).getTime();
        const daysOverdue = Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24));
        return {
          id: t.clickup_id,
          name: t.name,
          status: t.status,
          assignees: Array.isArray(t.assignees) ? t.assignees.map((a: { username?: string }) => a.username).filter(Boolean) : [],
          due_date: t.due_date,
          days_overdue: daysOverdue,
          priority: t.priority,
          list: listMap.get(t.list_id) ?? t.list_id,
        };
      }),
      count: overdueTasks.length,
    };
  }

  return { success: true, tasks: [], count: 0, message: 'No overdue tasks found.' };
}

// ---------------------------------------------------------------------------
// assign_task — assign or reassign a task to a team member
// ---------------------------------------------------------------------------

async function handleAssignTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const assigneeName = input.assignee_name as string;
  const replaceExisting = input.replace_existing === true;

  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }
  if (!assigneeName) {
    return { error: 'assignee_name is required', success: false };
  }

  const supabase = getSupabaseAdmin();

  // Resolve assignee name to ClickUp user ID
  const { data: member } = await supabase
    .from('cached_team_members')
    .select('clickup_id, username')
    .eq('workspace_id', workspaceId)
    .ilike('username', `%${assigneeName}%`)
    .limit(1)
    .single();

  if (!member) {
    return {
      error: `Could not find team member matching "${assigneeName}"`,
      success: false,
    };
  }

  const assigneeId = parseInt(member.clickup_id);

  // If replacing existing assignees, unassign them first via B-035 operations
  if (replaceExisting) {
    const { data: cachedTask } = await supabase
      .from('cached_tasks')
      .select('assignees')
      .eq('workspace_id', workspaceId)
      .eq('clickup_id', taskId)
      .single();

    const currentAssignees = Array.isArray(cachedTask?.assignees)
      ? cachedTask.assignees.map((a: { id?: number }) => a.id).filter(Boolean) as number[]
      : [];

    if (currentAssignees.length > 0) {
      await clickupUnassignTask(workspaceId, taskId, currentAssignees);
    }
  }

  // Use B-035 operations wrapper — handles validation, API call, and cache sync
  const result = await clickupAssignTask(workspaceId, taskId, [assigneeId]);

  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to assign task', success: false };
  }

  const updatedTask = result.data;
  return {
    success: true,
    task: {
      id: updatedTask.id,
      name: updatedTask.name,
      assignees: updatedTask.assignees.map((a) => a.username),
    },
    message: `Task "${updatedTask.name}" assigned to ${member.username}.`,
  };
}

// ---------------------------------------------------------------------------
// move_task — move a task to a different list
// ---------------------------------------------------------------------------

async function handleMoveTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const targetListName = input.target_list_name as string;

  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }
  if (!targetListName) {
    return { error: 'target_list_name is required', success: false };
  }

  const supabase = getSupabaseAdmin();

  // Resolve target list name to ID
  const { data: targetList } = await supabase
    .from('cached_lists')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${targetListName}%`)
    .limit(1)
    .single();

  if (!targetList) {
    return {
      error: `Could not find a list matching "${targetListName}"`,
      success: false,
    };
  }

  // Get current task info for the response
  const { data: currentTask } = await supabase
    .from('cached_tasks')
    .select('name, list_id')
    .eq('workspace_id', workspaceId)
    .eq('clickup_id', taskId)
    .single();

  // Get source list name
  let sourceListName = 'Unknown';
  if (currentTask?.list_id) {
    const { data: sourceList } = await supabase
      .from('cached_lists')
      .select('name')
      .eq('clickup_id', currentTask.list_id)
      .single();
    sourceListName = sourceList?.name ?? 'Unknown';
  }

  // Use B-035 operations wrapper — handles validation, API call, and cache sync
  const result = await clickupMoveTask(workspaceId, taskId, targetList.clickup_id);

  if (!result.success) {
    return { error: result.error ?? 'Failed to move task', success: false };
  }

  return {
    success: true,
    task: {
      id: taskId,
      name: currentTask?.name ?? taskId,
      from_list: sourceListName,
      to_list: targetList.name,
    },
    message: `Task "${currentTask?.name ?? taskId}" moved from "${sourceListName}" to "${targetList.name}".`,
  };
}

// ---------------------------------------------------------------------------
// get_workspace_summary — high-level workspace overview
// ---------------------------------------------------------------------------

async function handleGetWorkspaceSummary(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  // Fetch tasks, lists, and members in parallel
  const [
    { data: tasks },
    { data: lists },
    { data: members },
    { data: spaces },
  ] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select('clickup_id, status, assignees, due_date, priority, list_id')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_lists')
      .select('clickup_id, name')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('clickup_id, username, email, role')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_spaces')
      .select('clickup_id, name')
      .eq('workspace_id', workspaceId),
  ]);

  const allTasks = tasks ?? [];
  const allLists = lists ?? [];
  const allMembers = members ?? [];
  const allSpaces = spaces ?? [];

  // Tasks by status
  const byStatus: Record<string, number> = {};
  for (const t of allTasks) {
    const status = (t.status as string)?.toLowerCase() ?? 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // Tasks by assignee
  const byAssignee: Record<string, number> = {};
  let unassignedCount = 0;
  for (const t of allTasks) {
    const assignees = Array.isArray(t.assignees) ? t.assignees : [];
    if (assignees.length === 0) {
      unassignedCount++;
    }
    for (const a of assignees) {
      const name = (a as { username?: string }).username ?? 'Unknown';
      byAssignee[name] = (byAssignee[name] || 0) + 1;
    }
  }

  // Tasks by priority
  const byPriority: Record<string, number> = {};
  const priorityLabels: Record<number, string> = { 1: 'urgent', 2: 'high', 3: 'normal', 4: 'low' };
  for (const t of allTasks) {
    const label = priorityLabels[t.priority as number] ?? 'none';
    byPriority[label] = (byPriority[label] || 0) + 1;
  }

  // Overdue count
  const now = new Date();
  const overdueCount = allTasks.filter((t) => {
    if (!t.due_date) return false;
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    return new Date(t.due_date) < now;
  }).length;

  // Tasks by list
  const listMap = new Map(allLists.map((l) => [l.clickup_id, l.name]));
  const byList: Record<string, number> = {};
  for (const t of allTasks) {
    const listName = listMap.get(t.list_id as string) ?? 'Unknown';
    byList[listName] = (byList[listName] || 0) + 1;
  }

  return {
    success: true,
    summary: {
      total_tasks: allTasks.length,
      overdue_tasks: overdueCount,
      unassigned_tasks: unassignedCount,
      total_lists: allLists.length,
      total_spaces: allSpaces.length,
      total_members: allMembers.length,
      tasks_by_status: byStatus,
      tasks_by_assignee: byAssignee,
      tasks_by_priority: byPriority,
      tasks_by_list: byList,
      members: allMembers.map((m) => ({
        name: m.username,
        email: m.email,
        role: m.role,
      })),
      lists: allLists.map((l) => l.name),
      spaces: allSpaces.map((s) => s.name),
    },
  };
}

// ---------------------------------------------------------------------------
// get_weekly_summary — time-scoped progress report
// ---------------------------------------------------------------------------

async function handleGetWeeklySummary(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const period = (input.period as string) ?? 'this_week';
  let startDate: Date;
  let endDate: Date;

  if (period === 'custom' && input.start_date && input.end_date) {
    startDate = new Date(input.start_date as string);
    endDate = new Date(input.end_date as string);
  } else {
    const range = getDateRange(period === 'yesterday' ? 'today' : period);
    startDate = range.startDate;
    endDate = range.endDate;

    if (period === 'yesterday') {
      endDate = new Date(startDate);
      startDate = new Date(startDate);
      startDate.setDate(startDate.getDate() - 1);
      endDate.setHours(0, 0, 0, 0);
    }
  }

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  const nowISO = new Date().toISOString();

  // Fetch all tasks in the workspace (we need to filter by multiple date conditions)
  const { data: allTasks, error } = await supabase
    .from('cached_tasks')
    .select('clickup_id, name, status, assignees, due_date, priority, list_id, created_at, updated_at')
    .eq('workspace_id', workspaceId);

  if (error) {
    return { error: `Failed to fetch tasks: ${error.message}`, success: false };
  }

  const tasks = allTasks ?? [];

  // Completed/closed status patterns
  const isCompleted = (status: string | null) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('closed') || s.includes('complete') || s.includes('done') || s.includes('deployed');
  };

  const isInProgress = (status: string | null) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('in progress') || s.includes('in review') || s.includes('feedback');
  };

  // Tasks completed during this period (updated_at within range AND status is complete)
  const completedThisPeriod = tasks.filter((t) => {
    if (!isCompleted(t.status)) return false;
    const updated = t.updated_at ?? t.created_at;
    return updated >= startISO && updated <= endISO;
  });

  // Tasks due during this period
  const dueThisPeriod = tasks.filter((t) => {
    if (!t.due_date) return false;
    return t.due_date >= startISO && t.due_date <= endISO;
  });

  // Tasks created during this period
  const createdThisPeriod = tasks.filter((t) => {
    return t.created_at >= startISO && t.created_at <= endISO;
  });

  // Tasks currently overdue (due before now, not completed)
  const overdueNow = tasks.filter((t) => {
    if (!t.due_date) return false;
    if (isCompleted(t.status)) return false;
    return t.due_date < nowISO;
  });

  // Tasks currently in progress
  const inProgressNow = tasks.filter((t) => isInProgress(t.status));

  // Build list name map for enrichment
  const listIds = [...new Set(tasks.map((t) => t.list_id))];
  const { data: lists } = await supabase
    .from('cached_lists')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId)
    .in('clickup_id', listIds.length > 0 ? listIds : ['']);
  const listMap = new Map((lists ?? []).map((l: { clickup_id: string; name: string }) => [l.clickup_id, l.name]));

  // Helper to format task list (limited to avoid huge payloads)
  const formatTasks = (taskList: typeof tasks, limit = 15) =>
    taskList.slice(0, limit).map((t) => ({
      id: t.clickup_id,
      name: t.name,
      status: t.status,
      due_date: t.due_date,
      list: listMap.get(t.list_id) ?? t.list_id,
      assignees: Array.isArray(t.assignees) ? t.assignees.map((a: { username?: string }) => a.username).filter(Boolean) : [],
    }));

  // Status breakdown for tasks due this period
  const dueByStatus: Record<string, number> = {};
  for (const t of dueThisPeriod) {
    const status = t.status ?? 'unknown';
    dueByStatus[status] = (dueByStatus[status] || 0) + 1;
  }

  return {
    success: true,
    period,
    start_date: startISO,
    end_date: endISO,
    summary: {
      completed_count: completedThisPeriod.length,
      due_count: dueThisPeriod.length,
      created_count: createdThisPeriod.length,
      overdue_count: overdueNow.length,
      in_progress_count: inProgressNow.length,
      total_tasks: tasks.length,
    },
    completed_tasks: formatTasks(completedThisPeriod),
    due_tasks: formatTasks(dueThisPeriod),
    created_tasks: formatTasks(createdThisPeriod, 10),
    overdue_tasks: formatTasks(overdueNow, 10),
    in_progress_tasks: formatTasks(inProgressNow, 10),
    due_by_status: dueByStatus,
  };
}

// ---------------------------------------------------------------------------
// get_team_activity — recent webhook-based activity feed
// ---------------------------------------------------------------------------

async function handleGetTeamActivity(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const hours = Math.min(
    typeof input.hours === 'number' ? input.hours : 24,
    168,
  );
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // webhook_events schema: id, workspace_id, webhook_id, event_type, payload (jsonb),
  // processed, processed_at, error, created_at, source, received_at.
  // Task details (task_id, task_name, triggered_by) are inside the payload jsonb.
  let query = supabase
    .from('webhook_events')
    .select('id, event_type, payload, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (input.event_type && typeof input.event_type === 'string') {
    query = query.eq('event_type', input.event_type);
  }

  const limit = Math.min(
    typeof input.limit === 'number' ? input.limit : 30,
    100,
  );
  query = query.limit(limit);

  const { data: events, error } = await query;

  if (error) {
    return { error: `Failed to fetch activity: ${error.message}`, success: false };
  }

  const allEvents = events ?? [];

  // Extract task details from the payload jsonb column
  const enrichedEvents = allEvents.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    return {
      event_type: e.event_type,
      task_id: (payload.task_id as string) ?? null,
      task_name: (payload.task_name as string) ?? (payload.name as string) ?? null,
      triggered_by: (payload.triggered_by as string) ?? (payload.user as string) ?? null,
      timestamp: e.created_at,
    };
  });

  // Filter by member name if requested
  let filteredEvents = enrichedEvents;
  if (input.member_name && typeof input.member_name === 'string') {
    const memberFilter = (input.member_name as string).toLowerCase();
    filteredEvents = enrichedEvents.filter((e) => {
      const triggeredBy = e.triggered_by?.toLowerCase() ?? '';
      return triggeredBy.includes(memberFilter);
    });
  }

  // Summarize event counts by type
  const eventCounts: Record<string, number> = {};
  for (const e of filteredEvents) {
    const type = e.event_type as string;
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  }

  return {
    success: true,
    period_hours: hours,
    since,
    total_events: filteredEvents.length,
    event_counts: eventCounts,
    events: filteredEvents,
  };
}

// ---------------------------------------------------------------------------
// get_time_tracking_summary
// ---------------------------------------------------------------------------

async function handleGetTimeTrackingSummary(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const period = (input.period as string) ?? 'this_week';
  const { startDate, endDate } = getDateRange(period);

  let query = supabase
    .from('cached_time_entries')
    .select('clickup_id, task_id, user_id, duration, start_time, end_time, description')
    .eq('workspace_id', workspaceId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString());

  // Filter by member — need to resolve name to user_id
  if (input.member_name && typeof input.member_name === 'string') {
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.member_name}%`)
      .limit(1)
      .single();

    if (member) {
      query = query.eq('user_id', member.clickup_id);
    }
  }

  const { data: entries, error } = await query;

  if (error) {
    return { error: `Failed to fetch time entries: ${error.message}`, success: false };
  }

  const timeEntries = entries ?? [];
  const totalMs = timeEntries.reduce(
    (sum, e) => sum + (typeof e.duration === 'number' ? e.duration : 0),
    0,
  );

  // Resolve user_ids and task_ids for grouping
  const userIds = [...new Set(timeEntries.map((e) => e.user_id))];
  const taskIds = [...new Set(timeEntries.map((e) => e.task_id))];

  const [{ data: members }, { data: tasks }] = await Promise.all([
    supabase
      .from('cached_team_members')
      .select('clickup_id, username')
      .eq('workspace_id', workspaceId)
      .in('clickup_id', userIds.length > 0 ? userIds : ['']),
    supabase
      .from('cached_tasks')
      .select('clickup_id, name, list_id')
      .eq('workspace_id', workspaceId)
      .in('clickup_id', taskIds.length > 0 ? taskIds : ['']),
  ]);

  const memberMap = new Map((members ?? []).map((m) => [m.clickup_id, m.username]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.clickup_id, { name: t.name, list_id: t.list_id }]));

  const groupBy = (input.group_by as string) ?? 'member';
  const grouped: Record<string, number> = {};

  for (const entry of timeEntries) {
    let key: string;
    switch (groupBy) {
      case 'member':
        key = memberMap.get(entry.user_id) ?? 'Unknown';
        break;
      case 'task':
        key = taskMap.get(entry.task_id)?.name ?? 'Unknown';
        break;
      case 'list':
        key = taskMap.get(entry.task_id)?.list_id ?? 'Unknown';
        break;
      case 'day':
        key = entry.start_time
          ? new Date(entry.start_time).toISOString().split('T')[0]
          : 'Unknown';
        break;
      default:
        key = memberMap.get(entry.user_id) ?? 'Unknown';
    }
    grouped[key] = (grouped[key] || 0) + (typeof entry.duration === 'number' ? entry.duration : 0);
  }

  const breakdown = Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .map(([key, ms]) => ({
      label: key,
      totalMs: ms,
      totalHours: Math.round((ms / 3_600_000) * 100) / 100,
    }));

  return {
    success: true,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalEntries: timeEntries.length,
    totalMs,
    totalHours: Math.round((totalMs / 3_600_000) * 100) / 100,
    groupBy,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// get_workspace_health — workspace health check
// ---------------------------------------------------------------------------

async function handleGetWorkspaceHealth(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const [
    { data: tasks },
    { data: lists },
    { data: members },
  ] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select('clickup_id, name, status, assignees, due_date, priority, list_id, date_updated')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_lists')
      .select('clickup_id, name, task_count')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('clickup_id, username')
      .eq('workspace_id', workspaceId),
  ]);

  const allTasks = tasks ?? [];
  const allLists = lists ?? [];
  const allMembers = members ?? [];
  const now = new Date();

  // Overdue tasks
  const overdueTasks = allTasks.filter((t) => {
    if (!t.due_date) return false;
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    return new Date(t.due_date) < now;
  });

  // Unassigned tasks (open only)
  const unassignedTasks = allTasks.filter((t) => {
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    return !Array.isArray(t.assignees) || t.assignees.length === 0;
  });

  // Stale tasks (not updated in 14+ days, still open)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const staleTasks = allTasks.filter((t) => {
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    const updated = t.date_updated ? new Date(t.date_updated) : null;
    return updated && updated < twoWeeksAgo;
  });

  // Missing due dates (open tasks)
  const missingDueDates = allTasks.filter((t) => {
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    return !t.due_date;
  });

  // Missing priority (open tasks)
  const missingPriority = allTasks.filter((t) => {
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) return false;
    return !t.priority;
  });

  // Workload distribution
  const workload: Record<string, number> = {};
  for (const t of allTasks) {
    const status = (t.status as string)?.toLowerCase() ?? '';
    if (status.includes('closed') || status.includes('complete')) continue;
    const assignees = Array.isArray(t.assignees) ? t.assignees : [];
    for (const a of assignees) {
      const name = (a as { username?: string }).username ?? 'Unknown';
      workload[name] = (workload[name] || 0) + 1;
    }
  }

  // Empty lists
  const emptyLists = allLists.filter((l) => (l.task_count ?? 0) === 0);

  // Health score (0-100)
  const openTasks = allTasks.filter((t) => {
    const status = (t.status as string)?.toLowerCase() ?? '';
    return !status.includes('closed') && !status.includes('complete');
  });
  const openCount = openTasks.length || 1;
  const overdueRatio = overdueTasks.length / openCount;
  const unassignedRatio = unassignedTasks.length / openCount;
  const staleRatio = staleTasks.length / openCount;
  const healthScore = Math.max(0, Math.round(100 - (overdueRatio * 40 + unassignedRatio * 30 + staleRatio * 30) * 100));

  return {
    success: true,
    health_score: healthScore,
    summary: {
      total_open_tasks: openCount,
      overdue_count: overdueTasks.length,
      unassigned_count: unassignedTasks.length,
      stale_count: staleTasks.length,
      missing_due_date_count: missingDueDates.length,
      missing_priority_count: missingPriority.length,
      empty_lists_count: emptyLists.length,
      total_members: allMembers.length,
    },
    overdue_tasks: overdueTasks.slice(0, 10).map((t) => ({
      id: t.clickup_id,
      name: t.name,
      due_date: t.due_date,
      status: t.status,
    })),
    unassigned_tasks: unassignedTasks.slice(0, 10).map((t) => ({
      id: t.clickup_id,
      name: t.name,
      status: t.status,
    })),
    stale_tasks: staleTasks.slice(0, 10).map((t) => ({
      id: t.clickup_id,
      name: t.name,
      status: t.status,
      last_updated: t.date_updated,
    })),
    workload_distribution: workload,
    empty_lists: emptyLists.map((l) => l.name),
  };
}

// ---------------------------------------------------------------------------
// Time tracking action handlers
// ---------------------------------------------------------------------------

async function handleStartTimeTracking(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }
  const teamId = await resolveTeamId(workspaceId);
  const client = new ClickUpClient(workspaceId);
  const description = input.description as string | undefined;

  try {
    const entry = await client.startTimeEntry(teamId, taskId, description);
    return {
      success: true,
      time_entry: { id: entry.id, task_id: taskId },
      message: `Timer started on task ${taskId}.${description ? ` Description: "${description}"` : ''}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false };
  }
}

async function handleStopTimeTracking(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const teamId = await resolveTeamId(workspaceId);
  const client = new ClickUpClient(workspaceId);

  try {
    const entry = await client.stopTimeEntry(teamId);
    const durationMs = typeof entry.duration === 'string' ? parseInt(entry.duration, 10) : 0;
    const durationHours = Math.round((durationMs / 3_600_000) * 100) / 100;
    return {
      success: true,
      time_entry: {
        id: entry.id,
        duration_ms: durationMs,
        duration_hours: durationHours,
        task: entry.task,
      },
      message: `Timer stopped. Logged ${durationHours} hours.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false };
  }
}

async function handleAddManualTimeEntry(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const durationHours = input.duration_hours as number;
  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }
  if (!durationHours || durationHours <= 0) {
    return { error: 'duration_hours must be a positive number', success: false };
  }

  const teamId = await resolveTeamId(workspaceId);
  const client = new ClickUpClient(workspaceId);
  const durationMs = Math.round(durationHours * 3_600_000);

  // Default to start of today, or parse provided date
  let startMs: number;
  if (input.date && typeof input.date === 'string') {
    startMs = new Date(input.date).getTime();
  } else {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    startMs = today.getTime();
  }

  const description = input.description as string | undefined;

  try {
    const entry = await client.addManualTimeEntry(teamId, taskId, startMs, durationMs, description);
    return {
      success: true,
      time_entry: {
        id: entry.id,
        task_id: taskId,
        duration_hours: durationHours,
      },
      message: `Logged ${durationHours} hours on task ${taskId}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false };
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve workspace team ID from cached data
// ---------------------------------------------------------------------------

async function resolveTeamId(workspaceId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('workspaces')
    .select('clickup_team_id')
    .eq('id', workspaceId)
    .single();

  if (!data?.clickup_team_id) {
    throw new Error('Could not resolve ClickUp team ID for this workspace');
  }
  return data.clickup_team_id;
}

// ---------------------------------------------------------------------------
// Docs handlers
// ---------------------------------------------------------------------------

async function handleSearchDocs(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const result = await clickupSearchDocs(workspaceId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to search docs', success: false };
  }
  const docs = result.data ?? [];
  return {
    success: true,
    docs: docs.map((d) => ({
      id: d.id,
      name: d.name,
      date_created: d.date_created,
    })),
    count: docs.length,
  };
}

async function handleGetDocPages(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const docId = input.doc_id as string;
  if (!docId) {
    return { error: 'doc_id is required', success: false };
  }
  const result = await clickupGetDocPages(workspaceId, docId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to get doc pages', success: false };
  }
  const pages = result.data ?? [];
  return {
    success: true,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      content: p.content,
      date_created: p.date_created,
    })),
    count: pages.length,
  };
}

async function handleCreateDoc(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const name = input.name as string;
  if (!name) {
    return { error: 'name is required', success: false };
  }
  const content = input.content as string | undefined;
  const result = await clickupCreateDoc(workspaceId, name, content);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to create doc', success: false };
  }
  return {
    success: true,
    doc: { id: result.data.id, name: result.data.name },
    message: `Document "${result.data.name}" created successfully.`,
  };
}

async function handleCreateDocPage(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const docId = input.doc_id as string;
  const name = input.name as string;
  if (!docId || !name) {
    return { error: 'doc_id and name are required', success: false };
  }
  const content = input.content as string | undefined;
  const result = await clickupCreateDocPage(workspaceId, docId, name, content);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to create doc page', success: false };
  }
  return {
    success: true,
    page: { id: result.data.id, name: result.data.name },
    message: `Page "${result.data.name}" created successfully.`,
  };
}

async function handleUpdateDocPage(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const docId = input.doc_id as string;
  const pageId = input.page_id as string;
  if (!docId || !pageId) {
    return { error: 'doc_id and page_id are required', success: false };
  }
  const params: { name?: string; content?: string } = {};
  if (input.name && typeof input.name === 'string') params.name = input.name;
  if (input.content && typeof input.content === 'string') params.content = input.content;

  if (Object.keys(params).length === 0) {
    return { error: 'At least name or content must be provided', success: false };
  }

  const result = await clickupUpdateDocPage(workspaceId, docId, pageId, params);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to update doc page', success: false };
  }
  return {
    success: true,
    page: { id: result.data.id, name: result.data.name },
    message: `Page "${result.data.name}" updated successfully.`,
  };
}

// ---------------------------------------------------------------------------
// Goals & Key Results handlers
// ---------------------------------------------------------------------------

async function handleGetGoals(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const teamId = await resolveTeamId(workspaceId);
  const result = await clickupGetGoals(workspaceId, teamId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to get goals', success: false };
  }
  const goals = result.data ?? [];
  return {
    success: true,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      percent_completed: g.percent_completed,
      due_date: g.due_date,
      color: g.color,
      archived: g.archived,
    })),
    count: goals.length,
  };
}

async function handleCreateGoal(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const name = input.name as string;
  const dueDate = input.due_date as string;
  if (!name || !dueDate) {
    return { error: 'name and due_date are required', success: false };
  }

  const teamId = await resolveTeamId(workspaceId);
  const supabase = getSupabaseAdmin();

  const params: {
    name: string;
    due_date: string;
    description?: string;
    multiple_owners?: boolean;
    owners?: number[];
    color?: string;
  } = { name, due_date: dueDate };

  if (input.description && typeof input.description === 'string') {
    params.description = input.description;
  }
  if (input.color && typeof input.color === 'string') {
    params.color = input.color;
  }
  if (input.owner_name && typeof input.owner_name === 'string') {
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.owner_name}%`)
      .limit(1)
      .single();
    if (member) {
      params.owners = [parseInt(member.clickup_id)];
      params.multiple_owners = false;
    }
  }

  const result = await clickupCreateGoal(workspaceId, teamId, params);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to create goal', success: false };
  }
  return {
    success: true,
    goal: { id: result.data.id, name: result.data.name },
    message: `Goal "${result.data.name}" created successfully.`,
  };
}

async function handleUpdateGoal(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const goalId = input.goal_id as string;
  if (!goalId) {
    return { error: 'goal_id is required', success: false };
  }

  const params: { name?: string; due_date?: string; description?: string; color?: string } = {};
  if (input.name && typeof input.name === 'string') params.name = input.name;
  if (input.due_date && typeof input.due_date === 'string') params.due_date = input.due_date;
  if (input.description && typeof input.description === 'string') params.description = input.description;
  if (input.color && typeof input.color === 'string') params.color = input.color;

  if (Object.keys(params).length === 0) {
    return { error: 'At least one field must be provided to update', success: false };
  }

  const result = await clickupUpdateGoal(workspaceId, goalId, params);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to update goal', success: false };
  }
  return {
    success: true,
    goal: { id: result.data.id, name: result.data.name },
    message: `Goal "${result.data.name}" updated successfully.`,
  };
}

async function handleGetKeyResults(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const goalId = input.goal_id as string;
  if (!goalId) {
    return { error: 'goal_id is required', success: false };
  }
  const result = await clickupGetKeyResults(workspaceId, goalId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to get key results', success: false };
  }
  const keyResults = result.data ?? [];
  return {
    success: true,
    key_results: keyResults.map((kr) => ({
      id: kr.id,
      name: kr.name,
      type: kr.type,
      steps_current: kr.steps_current,
      steps_start: kr.steps_start,
      steps_end: kr.steps_end,
      percent_completed: kr.percent_completed,
      completed: kr.completed,
      unit: kr.unit,
    })),
    count: keyResults.length,
  };
}

async function handleCreateKeyResult(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const goalId = input.goal_id as string;
  const name = input.name as string;
  if (!goalId || !name) {
    return { error: 'goal_id and name are required', success: false };
  }

  const supabase = getSupabaseAdmin();

  const params: {
    name: string;
    type: string;
    steps_start: number;
    steps_end: number;
    unit?: string;
    owners?: number[];
  } = {
    name,
    type: (input.type as string) ?? 'number',
    steps_start: typeof input.steps_start === 'number' ? input.steps_start : 0,
    steps_end: typeof input.steps_end === 'number' ? input.steps_end : 100,
  };

  if (input.unit && typeof input.unit === 'string') {
    params.unit = input.unit;
  }
  if (input.owner_name && typeof input.owner_name === 'string') {
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.owner_name}%`)
      .limit(1)
      .single();
    if (member) {
      params.owners = [parseInt(member.clickup_id)];
    }
  }

  const result = await clickupCreateKeyResult(workspaceId, goalId, params);
  if (!result.success || !result.data) {
    return { error: result.error ?? 'Failed to create key result', success: false };
  }
  return {
    success: true,
    key_result: { id: result.data.id, name: result.data.name, percent_completed: result.data.percent_completed },
    message: `Key result "${result.data.name}" created successfully.`,
  };
}

// ---------------------------------------------------------------------------
// Comments handlers
// ---------------------------------------------------------------------------

async function handleGetTaskComments(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }
  const result = await clickupGetTaskComments(workspaceId, taskId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to get comments', success: false };
  }
  const comments = result.data ?? [];
  return {
    success: true,
    comments: comments.map((c) => ({
      id: c.id,
      text: c.comment_text,
      author: c.user?.username ?? 'Unknown',
      date: c.date,
      resolved: c.resolved,
    })),
    count: comments.length,
  };
}

async function handleAddTaskComment(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const commentText = input.comment_text as string;
  if (!taskId || !commentText) {
    return { error: 'task_id and comment_text are required', success: false };
  }

  let assigneeId: number | undefined;
  if (input.assignee_name && typeof input.assignee_name === 'string') {
    const supabase = getSupabaseAdmin();
    const { data: member } = await supabase
      .from('cached_team_members')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.assignee_name}%`)
      .limit(1)
      .single();
    if (member) {
      assigneeId = parseInt(member.clickup_id);
    }
  }

  const result = await clickupCreateTaskComment(workspaceId, taskId, commentText, assigneeId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to add comment', success: false };
  }
  return {
    success: true,
    message: `Comment added to task ${taskId} successfully.`,
  };
}

// ---------------------------------------------------------------------------
// Tags handlers
// ---------------------------------------------------------------------------

async function handleGetTags(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  // Get all spaces for this workspace
  const { data: spaces } = await supabase
    .from('cached_spaces')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId);

  if (!spaces || spaces.length === 0) {
    return { success: true, tags: [], count: 0, message: 'No spaces found in workspace.' };
  }

  const client = new ClickUpClient(workspaceId);
  const allTags: Array<{ space: string; name: string; tag_bg: string; tag_fg: string }> = [];

  for (const space of spaces) {
    try {
      const tags = await client.getSpaceTags(space.clickup_id);
      for (const tag of tags) {
        allTags.push({
          space: space.name,
          name: tag.name,
          tag_bg: tag.tag_bg,
          tag_fg: tag.tag_fg,
        });
      }
    } catch {
      // Some spaces may not support tags
    }
  }

  return {
    success: true,
    tags: allTags,
    count: allTags.length,
  };
}

async function handleAddTagToTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const tagName = input.tag_name as string;
  if (!taskId || !tagName) {
    return { error: 'task_id and tag_name are required', success: false };
  }
  const result = await clickupAddTagToTask(workspaceId, taskId, tagName);
  if (!result.success) {
    return { error: result.error ?? 'Failed to add tag', success: false };
  }
  return {
    success: true,
    message: `Tag "${tagName}" added to task ${taskId}.`,
  };
}

async function handleRemoveTagFromTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const tagName = input.tag_name as string;
  if (!taskId || !tagName) {
    return { error: 'task_id and tag_name are required', success: false };
  }
  const result = await clickupRemoveTagFromTask(workspaceId, taskId, tagName);
  if (!result.success) {
    return { error: result.error ?? 'Failed to remove tag', success: false };
  }
  return {
    success: true,
    message: `Tag "${tagName}" removed from task ${taskId}.`,
  };
}

// ---------------------------------------------------------------------------
// Custom Fields handler
// ---------------------------------------------------------------------------

async function handleSetCustomField(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  if (!taskId) {
    return { error: 'task_id is required', success: false };
  }

  let fieldId = input.field_id as string | undefined;
  const fieldName = input.field_name as string | undefined;
  const value = input.value;

  // If field_name provided but no field_id, try to resolve it from the task's list
  if (!fieldId && fieldName) {
    const supabase = getSupabaseAdmin();
    const { data: task } = await supabase
      .from('cached_tasks')
      .select('list_id')
      .eq('workspace_id', workspaceId)
      .eq('clickup_id', taskId)
      .single();

    if (task?.list_id) {
      const client = new ClickUpClient(workspaceId);
      const fields = await client.getListCustomFields(task.list_id);
      const matchedField = fields.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase()
      );
      if (matchedField) {
        fieldId = matchedField.id;
      } else {
        return {
          error: `Could not find custom field "${fieldName}" in this task's list`,
          success: false,
        };
      }
    }
  }

  if (!fieldId) {
    return { error: 'field_id or field_name is required', success: false };
  }

  const result = await clickupSetCustomFieldValue(workspaceId, taskId, fieldId, value);
  if (!result.success) {
    return { error: result.error ?? 'Failed to set custom field', success: false };
  }
  return {
    success: true,
    message: `Custom field set on task ${taskId} successfully.`,
  };
}

// ---------------------------------------------------------------------------
// Dependencies & Links handlers
// ---------------------------------------------------------------------------

async function handleAddDependency(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const dependsOnTaskId = input.depends_on_task_id as string;
  if (!taskId || !dependsOnTaskId) {
    return { error: 'task_id and depends_on_task_id are required', success: false };
  }
  const result = await clickupAddDependency(workspaceId, taskId, dependsOnTaskId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to add dependency', success: false };
  }
  return {
    success: true,
    message: `Task ${taskId} now depends on task ${dependsOnTaskId}.`,
  };
}

async function handleRemoveDependency(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const dependsOnTaskId = input.depends_on_task_id as string;
  if (!taskId || !dependsOnTaskId) {
    return { error: 'task_id and depends_on_task_id are required', success: false };
  }
  const result = await clickupRemoveDependency(workspaceId, taskId, dependsOnTaskId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to remove dependency', success: false };
  }
  return {
    success: true,
    message: `Dependency between task ${taskId} and ${dependsOnTaskId} removed.`,
  };
}

async function handleAddTaskLink(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const linksToTaskId = input.links_to_task_id as string;
  if (!taskId || !linksToTaskId) {
    return { error: 'task_id and links_to_task_id are required', success: false };
  }
  const result = await clickupAddTaskLink(workspaceId, taskId, linksToTaskId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to add task link', success: false };
  }
  return {
    success: true,
    message: `Task ${taskId} linked to task ${linksToTaskId}.`,
  };
}

async function handleRemoveTaskLink(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const linksToTaskId = input.links_to_task_id as string;
  if (!taskId || !linksToTaskId) {
    return { error: 'task_id and links_to_task_id are required', success: false };
  }
  const result = await clickupRemoveTaskLink(workspaceId, taskId, linksToTaskId);
  if (!result.success) {
    return { error: result.error ?? 'Failed to remove task link', success: false };
  }
  return {
    success: true,
    message: `Link between task ${taskId} and ${linksToTaskId} removed.`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - dayOfWeek);
      endDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// Batch create tasks (CSV import)
// ---------------------------------------------------------------------------

async function handleBatchCreateTasks(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const tasks = input.tasks as Array<{
    name: string;
    list_name: string;
    description?: string;
    status?: string;
    assignee_name?: string;
    priority?: number;
    due_date?: string;
  }>;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return { error: 'tasks array is required and must not be empty', success: false };
  }

  if (tasks.length > 50) {
    return { error: 'Maximum 50 tasks per batch. Please split into smaller batches.', success: false };
  }

  const results: Array<{ name: string; success: boolean; task_id?: string; error?: string }> = [];
  let created = 0;
  let failed = 0;

  for (const task of tasks) {
    if (!task.name || !task.list_name) {
      results.push({ name: task.name || '(unnamed)', success: false, error: 'Missing name or list_name' });
      failed++;
      continue;
    }

    try {
      // Resolve list name to ClickUp list ID
      const supabase = getSupabaseAdmin();
      const { data: list } = await supabase
        .from('cached_lists')
        .select('clickup_id, name')
        .eq('workspace_id', workspaceId)
        .ilike('name', `%${task.list_name}%`)
        .limit(1)
        .single();

      if (!list) {
        results.push({ name: task.name, success: false, error: `List "${task.list_name}" not found` });
        failed++;
        continue;
      }

      const createParams: CreateTaskParams = {
        name: task.name,
        ...(task.description ? { description: task.description } : {}),
        ...(task.status ? { status: task.status } : {}),
        ...(task.priority ? { priority: task.priority } : {}),
        ...(task.due_date ? { due_date: new Date(task.due_date).getTime() } : {}),
      };

      // Resolve assignee if provided
      if (task.assignee_name) {
        const { data: member } = await supabase
          .from('cached_team_members')
          .select('clickup_id')
          .eq('workspace_id', workspaceId)
          .ilike('username', `%${task.assignee_name}%`)
          .limit(1)
          .single();

        if (member) {
          createParams.assignees = [parseInt(member.clickup_id)];
        }
      }

      const result = await clickupCreateTask(workspaceId, list.clickup_id, createParams);

      if (result.success && result.data) {
        results.push({ name: task.name, success: true, task_id: result.data.id });
        created++;
      } else {
        results.push({ name: task.name, success: false, error: result.error || 'Creation failed' });
        failed++;
      }
    } catch (err) {
      results.push({ name: task.name, success: false, error: err instanceof Error ? err.message : String(err) });
      failed++;
    }
  }

  return {
    success: failed === 0,
    created,
    failed,
    total: tasks.length,
    results,
    summary: `Created ${created}/${tasks.length} tasks${failed > 0 ? ` (${failed} failed)` : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Attach file content to task (as comment)
// ---------------------------------------------------------------------------

async function handleAttachFileContentToTask(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const taskId = input.task_id as string;
  const fileName = input.file_name as string;
  const fileContent = input.file_content as string;

  if (!taskId || !fileName || !fileContent) {
    return { error: 'task_id, file_name, and file_content are required', success: false };
  }

  // Truncate content if too long for a comment (ClickUp comment limit)
  const maxCommentLen = 25_000;
  const truncated = fileContent.length > maxCommentLen;
  const content = truncated
    ? fileContent.slice(0, maxCommentLen) + '\n\n... (content truncated)'
    : fileContent;

  const commentText = `**Attached file: ${fileName}**\n\n\`\`\`\n${content}\n\`\`\``;

  const result = await clickupCreateTaskComment(workspaceId, taskId, commentText);

  if (result.success) {
    return {
      success: true,
      message: `File "${fileName}" content attached to task ${taskId} as a comment${truncated ? ' (truncated)' : ''}`,
    };
  }

  return { success: false, error: result.error || 'Failed to attach file content' };
}
