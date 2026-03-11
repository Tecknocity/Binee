import { createClient } from '@supabase/supabase-js';
import { ClickUpClient } from '@/lib/clickup/client';

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
      case 'get_workspace_health':
        return await handleGetWorkspaceHealth(workspaceId);
      case 'get_time_tracking_summary':
        return await handleGetTimeTrackingSummary(toolInput, workspaceId);
      default:
        return { error: `Unknown tool: ${toolName}`, success: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message, success: false };
  }
}

// ---------------------------------------------------------------------------
// lookup_tasks
// ---------------------------------------------------------------------------

async function handleLookupTasks(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('cached_tasks')
    .select('clickup_task_id, name, status, assignee_name, due_date, priority, list_name, description')
    .eq('workspace_id', workspaceId);

  // Apply filters
  if (input.assignee && typeof input.assignee === 'string') {
    query = query.ilike('assignee_name', `%${input.assignee}%`);
  }

  if (input.status && typeof input.status === 'string') {
    query = query.ilike('status', `%${input.status}%`);
  }

  if (input.list_name && typeof input.list_name === 'string') {
    query = query.ilike('list_name', `%${input.list_name}%`);
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

  return {
    success: true,
    tasks: tasks ?? [],
    count: tasks?.length ?? 0,
  };
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

  const client = new ClickUpClient(workspaceId);
  const supabase = getSupabaseAdmin();

  // Build update params
  const updateParams: Record<string, unknown> = {};

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
      .from('cached_members')
      .select('clickup_user_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.assignee_name}%`)
      .limit(1)
      .single();

    if (member) {
      updateParams.assignees = { add: [member.clickup_user_id] };
    } else {
      return {
        error: `Could not find team member matching "${input.assignee_name}"`,
        success: false,
      };
    }
  }

  // Call ClickUp API
  const updatedTask = await client.updateTask(taskId, updateParams);

  // Update the cached task in Supabase
  const cacheUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) cacheUpdate.status = input.status;
  if (input.due_date) cacheUpdate.due_date = input.due_date;
  if (input.priority) cacheUpdate.priority = input.priority;

  await supabase
    .from('cached_tasks')
    .update(cacheUpdate)
    .eq('workspace_id', workspaceId)
    .eq('clickup_task_id', taskId);

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
  const client = new ClickUpClient(workspaceId);

  // Resolve list name to ClickUp list ID
  const { data: list } = await supabase
    .from('cached_lists')
    .select('clickup_list_id, name')
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

  // Build create params
  const createParams: Record<string, unknown> = {
    name: taskName,
  };

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
      .from('cached_members')
      .select('clickup_user_id')
      .eq('workspace_id', workspaceId)
      .ilike('username', `%${input.assignee_name}%`)
      .limit(1)
      .single();

    if (member) {
      createParams.assignees = [member.clickup_user_id];
    }
  }

  const createdTask = await client.createTask(list.clickup_list_id, createParams as any);

  // Insert into cache
  await supabase.from('cached_tasks').insert({
    workspace_id: workspaceId,
    clickup_task_id: createdTask.id,
    name: createdTask.name,
    status: createdTask.status.status,
    assignee_name: createdTask.assignees[0]?.username ?? null,
    due_date: createdTask.due_date
      ? new Date(parseInt(createdTask.due_date)).toISOString()
      : null,
    priority: createdTask.priority?.priority ?? null,
    list_name: list.name,
    list_id: list.clickup_list_id,
    description: createdTask.description,
  });

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
// get_workspace_health
// ---------------------------------------------------------------------------

async function handleGetWorkspaceHealth(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all tasks for the workspace
  const { data: tasks, error } = await supabase
    .from('cached_tasks')
    .select('clickup_task_id, name, status, assignee_name, due_date, priority, list_name, updated_at, description')
    .eq('workspace_id', workspaceId);

  if (error) {
    return { error: `Failed to fetch tasks: ${error.message}`, success: false };
  }

  const allTasks = tasks ?? [];
  const openTasks = allTasks.filter(
    (t) => t.status !== 'closed' && t.status !== 'complete',
  );

  // Overdue tasks
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && t.due_date < now,
  );

  // Unassigned tasks
  const unassignedTasks = openTasks.filter((t) => !t.assignee_name);

  // Stale tasks (no update in 7+ days)
  const staleTasks = openTasks.filter(
    (t) => t.updated_at && t.updated_at < sevenDaysAgo,
  );

  // Workload distribution
  const workloadMap: Record<string, number> = {};
  for (const task of openTasks) {
    const assignee = task.assignee_name ?? 'Unassigned';
    workloadMap[assignee] = (workloadMap[assignee] || 0) + 1;
  }

  const workload = Object.entries(workloadMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, taskCount: count }));

  // Missing metadata
  const missingDueDate = openTasks.filter((t) => !t.due_date);
  const missingPriority = openTasks.filter((t) => !t.priority);
  const missingDescription = openTasks.filter((t) => !t.description);

  return {
    success: true,
    health: {
      totalTasks: allTasks.length,
      openTasks: openTasks.length,
      overdue: {
        count: overdueTasks.length,
        tasks: overdueTasks.slice(0, 10).map((t) => ({
          id: t.clickup_task_id,
          name: t.name,
          assignee: t.assignee_name,
          due_date: t.due_date,
        })),
      },
      unassigned: {
        count: unassignedTasks.length,
        tasks: unassignedTasks.slice(0, 10).map((t) => ({
          id: t.clickup_task_id,
          name: t.name,
          list: t.list_name,
        })),
      },
      stale: {
        count: staleTasks.length,
        tasks: staleTasks.slice(0, 10).map((t) => ({
          id: t.clickup_task_id,
          name: t.name,
          assignee: t.assignee_name,
          last_updated: t.updated_at,
        })),
      },
      workloadDistribution: workload,
      missingMetadata: {
        noDueDate: missingDueDate.length,
        noPriority: missingPriority.length,
        noDescription: missingDescription.length,
      },
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

  // Determine date range based on period
  const period = (input.period as string) ?? 'this_week';
  const { startDate, endDate } = getDateRange(period);

  let query = supabase
    .from('cached_time_entries')
    .select('clickup_entry_id, task_name, user_name, duration_ms, start_time, end_time, list_name')
    .eq('workspace_id', workspaceId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString());

  // Filter by member
  if (input.member_name && typeof input.member_name === 'string') {
    query = query.ilike('user_name', `%${input.member_name}%`);
  }

  const { data: entries, error } = await query;

  if (error) {
    return { error: `Failed to fetch time entries: ${error.message}`, success: false };
  }

  const timeEntries = entries ?? [];
  const totalMs = timeEntries.reduce(
    (sum, e) => sum + (typeof e.duration_ms === 'number' ? e.duration_ms : 0),
    0,
  );

  // Group by the requested dimension
  const groupBy = (input.group_by as string) ?? 'member';
  const grouped: Record<string, number> = {};

  for (const entry of timeEntries) {
    let key: string;
    switch (groupBy) {
      case 'member':
        key = entry.user_name ?? 'Unknown';
        break;
      case 'task':
        key = entry.task_name ?? 'Unknown';
        break;
      case 'list':
        key = entry.list_name ?? 'Unknown';
        break;
      case 'day':
        key = entry.start_time
          ? new Date(entry.start_time).toISOString().split('T')[0]
          : 'Unknown';
        break;
      default:
        key = entry.user_name ?? 'Unknown';
    }
    grouped[key] = (grouped[key] || 0) + (typeof entry.duration_ms === 'number' ? entry.duration_ms : 0);
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
      endDate.setDate(0); // last day of previous month
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
