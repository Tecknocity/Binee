import { createClient } from '@supabase/supabase-js';
import { ClickUpClient } from '@/lib/clickup/client';
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
      case 'get_workspace_health':
        return await handleGetWorkspaceHealth(workspaceId);
      case 'get_time_tracking_summary':
        return await handleGetTimeTrackingSummary(toolInput, workspaceId);
      case 'create_dashboard_widget':
        return await handleCreateDashboardWidget(toolInput, workspaceId);
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

  const client = new ClickUpClient(workspaceId);
  const supabase = getSupabaseAdmin();

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

  const updatedTask = await client.updateTask(taskId, updateParams);

  // Update the cached task
  const cacheUpdate: Record<string, unknown> = { updated_at: new Date().toISOString(), synced_at: new Date().toISOString() };
  if (input.status) cacheUpdate.status = input.status;
  if (input.due_date) cacheUpdate.due_date = input.due_date;
  if (input.priority) cacheUpdate.priority = input.priority;

  await supabase
    .from('cached_tasks')
    .update(cacheUpdate)
    .eq('workspace_id', workspaceId)
    .eq('clickup_id', taskId);

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

  const createParams: Record<string, unknown> = { name: taskName };

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdTask = await client.createTask(list.clickup_id, createParams as any);

  // Insert into cache
  await supabase.from('cached_tasks').insert({
    workspace_id: workspaceId,
    clickup_id: createdTask.id,
    name: createdTask.name,
    status: createdTask.status.status,
    assignees: createdTask.assignees,
    due_date: createdTask.due_date
      ? new Date(parseInt(createdTask.due_date)).toISOString()
      : null,
    priority: createdTask.priority ? parseInt(createdTask.priority.orderindex) : null,
    list_id: list.clickup_id,
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
