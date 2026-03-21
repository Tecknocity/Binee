import { createClient } from '@supabase/supabase-js';
import {
  createTask as clickupCreateTask,
  updateTask as clickupUpdateTask,
  assignTask as clickupAssignTask,
  unassignTask as clickupUnassignTask,
  moveTask as clickupMoveTask,
} from '@/lib/clickup/operations';
import type { CreateTaskParams, UpdateTaskParams } from '@/types/clickup';
import { runHealthCheck } from '@/lib/health/checker';

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
      case 'get_team_activity':
        return await handleGetTeamActivity(toolInput, workspaceId);
      case 'get_workspace_health':
        return await handleGetWorkspaceHealth(workspaceId);
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

  if (input.query && typeof input.query === 'string') {
    query = query.or(
      `name.ilike.%${input.query}%,description.ilike.%${input.query}%`,
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
    const listIds = [...new Set(enrichedTasks.map((t) => t.list_id))];
    const { data: lists } = await supabase
      .from('cached_lists')
      .select('clickup_id, name')
      .eq('workspace_id', workspaceId)
      .in('clickup_id', listIds);

    const listMap = new Map((lists ?? []).map((l) => [l.clickup_id, l.name]));

    return {
      success: true,
      tasks: enrichedTasks.map((t) => ({
        id: t.clickup_id,
        name: t.name,
        status: t.status,
        assignees: Array.isArray(t.assignees) ? t.assignees.map((a: { username?: string }) => a.username).filter(Boolean) : [],
        due_date: t.due_date,
        priority: t.priority,
        list: listMap.get(t.list_id) ?? t.list_id,
      })),
      count: enrichedTasks.length,
    };
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

  let query = supabase
    .from('webhook_events')
    .select('id, event_type, task_id, task_name, triggered_by, payload, created_at')
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

  // Filter by member name if requested
  let filteredEvents = allEvents;
  if (input.member_name && typeof input.member_name === 'string') {
    const memberFilter = (input.member_name as string).toLowerCase();
    filteredEvents = allEvents.filter((e) => {
      const triggeredBy = (e.triggered_by as string)?.toLowerCase() ?? '';
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
    events: filteredEvents.map((e) => ({
      event_type: e.event_type,
      task_id: e.task_id,
      task_name: e.task_name,
      triggered_by: e.triggered_by,
      timestamp: e.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// get_workspace_health — uses real health checker
// ---------------------------------------------------------------------------

async function handleGetWorkspaceHealth(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  // Get previous health score for trend comparison
  const { data: lastCheck } = await supabase
    .from('health_check_results')
    .select('overall_score')
    .eq('workspace_id', workspaceId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  const previousScore = lastCheck?.overall_score ?? undefined;
  const result = await runHealthCheck(workspaceId, previousScore);

  // Store the health check result
  await supabase.from('health_check_results').insert({
    workspace_id: workspaceId,
    overall_score: result.overall_score,
    category_scores: result.category_scores,
    issues: result.issues,
    recommendations: result.recommendations,
    previous_score: previousScore ?? null,
    credits_used: 1,
  });

  return {
    success: true,
    health: {
      overall_score: result.overall_score,
      previous_score: previousScore,
      trend: previousScore !== undefined
        ? result.overall_score > previousScore ? 'improving' : result.overall_score < previousScore ? 'declining' : 'stable'
        : 'first_check',
      category_scores: result.category_scores,
      issues: result.issues,
      recommendations: result.recommendations,
    },
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
// create_dashboard_widget — conversational dashboard builder
// ---------------------------------------------------------------------------

async function handleCreateDashboardWidget(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const widgetType = input.widget_type as string;
  const title = input.title as string;
  const config = (input.config as Record<string, unknown>) ?? {};
  const dashboardName = (input.dashboard_name as string) ?? 'My Dashboard';

  if (!widgetType || !title) {
    return { error: 'widget_type and title are required', success: false };
  }

  // Find or create the dashboard
  let dashboardId: string;
  const { data: existingDashboard } = await supabase
    .from('dashboards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${dashboardName}%`)
    .limit(1)
    .single();

  if (existingDashboard) {
    dashboardId = existingDashboard.id;
  } else {
    const { data: newDashboard, error: createError } = await supabase
      .from('dashboards')
      .insert({
        workspace_id: workspaceId,
        name: dashboardName,
        description: `Created by Binee`,
        created_by: 'system',
        is_default: false,
      })
      .select('id')
      .single();

    if (createError || !newDashboard) {
      return { error: `Failed to create dashboard: ${createError?.message}`, success: false };
    }
    dashboardId = newDashboard.id;
  }

  // Get current widget count for positioning
  const { count } = await supabase
    .from('dashboard_widgets')
    .select('id', { count: 'exact', head: true })
    .eq('dashboard_id', dashboardId);

  const widgetCount = count ?? 0;
  const col = (widgetCount % 3) * 4;
  const row = Math.floor(widgetCount / 3) * 3;

  // Create the widget
  const { data: widget, error: widgetError } = await supabase
    .from('dashboard_widgets')
    .insert({
      workspace_id: workspaceId,
      dashboard_id: dashboardId,
      type: widgetType,
      title,
      config,
      position: { x: col, y: row, w: 4, h: 3 },
    })
    .select('id, type, title')
    .single();

  if (widgetError || !widget) {
    return { error: `Failed to create widget: ${widgetError?.message}`, success: false };
  }

  return {
    success: true,
    widget: {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      dashboard: dashboardName,
    },
    message: `Widget "${title}" added to dashboard "${dashboardName}". You can view it on the Dashboards page.`,
  };
}

// ---------------------------------------------------------------------------
// update_dashboard_widget — modify an existing widget
// ---------------------------------------------------------------------------

async function handleUpdateDashboardWidget(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const widgetId = input.widget_id as string;

  if (!widgetId) {
    return { error: 'widget_id is required', success: false };
  }

  // Fetch existing widget
  const { data: existing, error: fetchError } = await supabase
    .from('dashboard_widgets')
    .select('id, type, title, config, dashboard_id')
    .eq('workspace_id', workspaceId)
    .eq('id', widgetId)
    .single();

  if (fetchError || !existing) {
    return { error: `Widget not found: ${fetchError?.message ?? 'unknown'}`, success: false };
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title && typeof input.title === 'string') {
    updates.title = input.title;
  }

  if (input.widget_type && typeof input.widget_type === 'string') {
    // Map API types to DB types
    const typeMap: Record<string, string> = {
      bar_chart: 'bar',
      line_chart: 'line',
      summary_card: 'summary',
      table: 'table',
    };
    updates.type = typeMap[input.widget_type] ?? input.widget_type;
  }

  if (input.config && typeof input.config === 'object') {
    // Merge with existing config
    updates.config = { ...(existing.config as Record<string, unknown>), ...(input.config as Record<string, unknown>) };
  }

  const { error: updateError } = await supabase
    .from('dashboard_widgets')
    .update(updates)
    .eq('id', widgetId)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    return { error: `Failed to update widget: ${updateError.message}`, success: false };
  }

  // Get dashboard name for the response
  const { data: dashboard } = await supabase
    .from('dashboards')
    .select('name')
    .eq('id', existing.dashboard_id)
    .single();

  return {
    success: true,
    widget: {
      id: widgetId,
      title: (updates.title as string) ?? existing.title,
      type: (updates.type as string) ?? existing.type,
      dashboard: dashboard?.name ?? 'Unknown',
    },
    message: `Widget "${(updates.title as string) ?? existing.title}" has been updated on dashboard "${dashboard?.name}".`,
  };
}

// ---------------------------------------------------------------------------
// delete_dashboard_widget — remove a widget from a dashboard
// ---------------------------------------------------------------------------

async function handleDeleteDashboardWidget(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const widgetId = input.widget_id as string;

  if (!widgetId) {
    return { error: 'widget_id is required', success: false };
  }

  // Fetch widget info before deleting (for the response message)
  const { data: widget, error: fetchError } = await supabase
    .from('dashboard_widgets')
    .select('id, title, dashboard_id')
    .eq('workspace_id', workspaceId)
    .eq('id', widgetId)
    .single();

  if (fetchError || !widget) {
    return { error: `Widget not found: ${fetchError?.message ?? 'unknown'}`, success: false };
  }

  const { data: dashboard } = await supabase
    .from('dashboards')
    .select('name')
    .eq('id', widget.dashboard_id)
    .single();

  const { error: deleteError } = await supabase
    .from('dashboard_widgets')
    .delete()
    .eq('id', widgetId)
    .eq('workspace_id', workspaceId);

  if (deleteError) {
    return { error: `Failed to delete widget: ${deleteError.message}`, success: false };
  }

  return {
    success: true,
    deleted_widget: {
      id: widgetId,
      title: widget.title,
      dashboard: dashboard?.name ?? 'Unknown',
    },
    message: `Widget "${widget.title}" has been removed from dashboard "${dashboard?.name}".`,
  };
}

// ---------------------------------------------------------------------------
// list_dashboards — list all dashboards in the workspace
// ---------------------------------------------------------------------------

async function handleListDashboards(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const { data: dashboards, error } = await supabase
    .from('dashboards')
    .select('id, name, description, is_default, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    return { error: `Failed to list dashboards: ${error.message}`, success: false };
  }

  // Get widget counts per dashboard
  const dashboardList = dashboards ?? [];
  const dashboardIds = dashboardList.map((d) => d.id);

  let widgetCounts: Record<string, number> = {};
  if (dashboardIds.length > 0) {
    const { data: widgets } = await supabase
      .from('dashboard_widgets')
      .select('dashboard_id')
      .eq('workspace_id', workspaceId)
      .in('dashboard_id', dashboardIds);

    widgetCounts = (widgets ?? []).reduce((acc: Record<string, number>, w) => {
      acc[w.dashboard_id] = (acc[w.dashboard_id] || 0) + 1;
      return acc;
    }, {});
  }

  return {
    success: true,
    dashboards: dashboardList.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      is_default: d.is_default,
      widget_count: widgetCounts[d.id] ?? 0,
      updated_at: d.updated_at,
    })),
    count: dashboardList.length,
  };
}

// ---------------------------------------------------------------------------
// list_dashboard_widgets — list widgets on a specific dashboard
// ---------------------------------------------------------------------------

async function handleListDashboardWidgets(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  let dashboardId = input.dashboard_id as string | undefined;

  // Resolve by name if ID not provided
  if (!dashboardId && input.dashboard_name && typeof input.dashboard_name === 'string') {
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${input.dashboard_name}%`)
      .limit(1)
      .single();

    if (dashboard) {
      dashboardId = dashboard.id;
    } else {
      return { error: `No dashboard found matching "${input.dashboard_name}"`, success: false };
    }
  }

  // If still no dashboard, use default
  if (!dashboardId) {
    const { data: defaultDash } = await supabase
      .from('dashboards')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .limit(1)
      .single();

    if (defaultDash) {
      dashboardId = defaultDash.id;
    } else {
      return { error: 'No dashboards found in workspace', success: false };
    }
  }

  const { data: widgets, error } = await supabase
    .from('dashboard_widgets')
    .select('id, type, title, config, position, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('dashboard_id', dashboardId)
    .order('created_at', { ascending: true });

  if (error) {
    return { error: `Failed to list widgets: ${error.message}`, success: false };
  }

  // Get dashboard name
  const { data: dashboard } = await supabase
    .from('dashboards')
    .select('name')
    .eq('id', dashboardId)
    .single();

  return {
    success: true,
    dashboard_name: dashboard?.name ?? 'Unknown',
    dashboard_id: dashboardId,
    widgets: (widgets ?? []).map((w) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      config: w.config,
      position: w.position,
    })),
    count: (widgets ?? []).length,
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
