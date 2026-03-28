import { createClient } from '@supabase/supabase-js';
import {
  createTask as clickupCreateTask,
  updateTask as clickupUpdateTask,
  assignTask as clickupAssignTask,
  unassignTask as clickupUnassignTask,
  moveTask as clickupMoveTask,
} from '@/lib/clickup/operations';
import type { CreateTaskParams, UpdateTaskParams } from '@/types/clickup';
import {
  handleCreateDashboardWidget,
  handleUpdateDashboardWidget,
  handleDeleteDashboardWidget,
  handleListDashboards,
  handleListDashboardWidgets,
} from '@/lib/ai/tools/dashboard-tools';

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
      case 'create_dashboard_widget':
        return await handleCreateDashboardWidget(toolInput, workspaceId);
      case 'update_dashboard_widget':
        return await handleUpdateDashboardWidget(toolInput, workspaceId);
      case 'delete_dashboard_widget':
        return await handleDeleteDashboardWidget(toolInput, workspaceId);
      case 'list_dashboards':
        return await handleListDashboards(workspaceId);
      case 'list_dashboard_widgets':
        return await handleListDashboardWidgets(toolInput, workspaceId);
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
