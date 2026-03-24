import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Dashboard tool handlers — extracted per B-066 PRD
// Handles create, update, delete, list dashboards and widgets.
// The AI decides what widget types to create based on KB knowledge (the
// dashboard-builder brain module). These handlers provide the mechanical
// interface only — no hardcoded widget type recommendations.
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
// Supported widget types — validated at creation time
// ---------------------------------------------------------------------------

const SUPPORTED_WIDGET_TYPES = [
  'bar',
  'line',
  'summary',
  'table',
  'donut',
  'time_tracking',
  'workload',
  'priority',
  'progress',
  'activity',
] as const;

type SupportedWidgetType = (typeof SUPPORTED_WIDGET_TYPES)[number];

// Map API-facing names to internal DB types
const WIDGET_TYPE_ALIASES: Record<string, SupportedWidgetType> = {
  bar_chart: 'bar',
  line_chart: 'line',
  summary_card: 'summary',
  pie_chart: 'donut',
  pie: 'donut',
  doughnut: 'donut',
  chart: 'bar',
};

function resolveWidgetType(input: string): SupportedWidgetType | null {
  const lower = input.toLowerCase().replace(/[\s-]/g, '_');
  if ((SUPPORTED_WIDGET_TYPES as readonly string[]).includes(lower)) {
    return lower as SupportedWidgetType;
  }
  return WIDGET_TYPE_ALIASES[lower] ?? null;
}

// ---------------------------------------------------------------------------
// Data query executor — queries cached tables based on data_query spec
// ---------------------------------------------------------------------------

interface DataQuery {
  data_source?: string; // tasks | time_entries | health | team_members
  metric?: string; // count | hours | score | sum
  group_by?: string; // status | assignee | list | priority | day | week | month
  filters?: Record<string, unknown>;
  sort_by?: string;
  limit?: number;
}

async function executeDataQuery(
  dataQuery: DataQuery,
  workspaceId: string,
): Promise<{ data: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  const supabase = getSupabaseAdmin();
  const source = dataQuery.data_source ?? 'tasks';

  if (source === 'tasks') {
    return await queryTasksData(supabase, dataQuery, workspaceId);
  }

  if (source === 'time_entries') {
    return await queryTimeEntriesData(supabase, dataQuery, workspaceId);
  }

  if (source === 'team_members') {
    return await queryTeamData(supabase, dataQuery, workspaceId);
  }

  if (source === 'health') {
    return await queryHealthData(supabase, workspaceId);
  }

  // Default: return empty with a hint
  return {
    data: [],
    summary: { data_source: source, note: 'Unsupported data source, defaulting to empty' },
  };
}

async function queryTasksData(
  supabase: ReturnType<typeof createClient>,
  dataQuery: DataQuery,
  workspaceId: string,
): Promise<{ data: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  let query = supabase
    .from('cached_tasks')
    .select('clickup_id, name, status, assignees, due_date, priority, list_id, time_spent')
    .eq('workspace_id', workspaceId);

  const filters = dataQuery.filters ?? {};

  // Apply filters
  if (filters.status && typeof filters.status === 'string') {
    query = query.ilike('status', `%${filters.status}%`);
  }

  if (filters.assignee && typeof filters.assignee === 'string') {
    query = query.contains('assignees', [{ username: filters.assignee }]);
  }

  if (filters.list_name && typeof filters.list_name === 'string') {
    const { data: matchingLists } = await supabase
      .from('cached_lists')
      .select('clickup_id')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${filters.list_name}%`);

    if (matchingLists && matchingLists.length > 0) {
      query = query.in('list_id', matchingLists.map((l) => l.clickup_id));
    }
  }

  if (filters.date_range && typeof filters.date_range === 'object') {
    const range = filters.date_range as { start?: string; end?: string };
    if (range.start) query = query.gte('due_date', range.start);
    if (range.end) query = query.lte('due_date', range.end);
  }

  if (filters.overdue === true) {
    const now = new Date().toISOString();
    query = query
      .lt('due_date', now)
      .not('status', 'ilike', '%closed%')
      .not('status', 'ilike', '%complete%');
  }

  const limit = Math.min(dataQuery.limit ?? 500, 500);
  query = query.limit(limit);

  const { data: tasks, error } = await query;

  if (error) {
    return { data: [], summary: { error: error.message } };
  }

  const allTasks = tasks ?? [];

  // Fetch list names for enrichment
  const listIds = [...new Set(allTasks.map((t) => t.list_id))];
  const { data: lists } = await supabase
    .from('cached_lists')
    .select('clickup_id, name')
    .eq('workspace_id', workspaceId)
    .in('clickup_id', listIds.length > 0 ? listIds : ['__none__']);

  const listMap = new Map((lists ?? []).map((l) => [l.clickup_id, l.name]));

  // Group data based on group_by
  const groupBy = dataQuery.group_by ?? 'status';
  const grouped: Record<string, number> = {};

  for (const task of allTasks) {
    let key: string;
    switch (groupBy) {
      case 'status':
        key = (task.status as string)?.toLowerCase() ?? 'unknown';
        break;
      case 'assignee': {
        const assignees = Array.isArray(task.assignees) ? task.assignees : [];
        if (assignees.length === 0) {
          key = 'Unassigned';
          grouped[key] = (grouped[key] || 0) + 1;
          continue;
        }
        for (const a of assignees) {
          const name = (a as { username?: string }).username ?? 'Unknown';
          grouped[name] = (grouped[name] || 0) + 1;
        }
        continue;
      }
      case 'list':
        key = listMap.get(task.list_id as string) ?? 'Unknown';
        break;
      case 'priority': {
        const priorityLabels: Record<number, string> = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low' };
        key = priorityLabels[task.priority as number] ?? 'None';
        break;
      }
      case 'day':
      case 'week':
      case 'month': {
        if (!task.due_date) {
          key = 'No date';
        } else {
          const d = new Date(task.due_date as string);
          if (groupBy === 'day') key = d.toISOString().split('T')[0];
          else if (groupBy === 'week') {
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            key = `Week of ${weekStart.toISOString().split('T')[0]}`;
          } else {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        break;
      }
      default:
        key = (task.status as string)?.toLowerCase() ?? 'unknown';
    }
    grouped[key] = (grouped[key] || 0) + 1;
  }

  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }));

  // Sort if requested
  if (dataQuery.sort_by === 'value_desc') {
    data.sort((a, b) => b.value - a.value);
  } else if (dataQuery.sort_by === 'value_asc') {
    data.sort((a, b) => a.value - b.value);
  } else if (dataQuery.sort_by === 'name') {
    data.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    data,
    summary: {
      total_tasks: allTasks.length,
      groups: data.length,
      group_by: groupBy,
      data_source: 'tasks',
    },
  };
}

async function queryTimeEntriesData(
  supabase: ReturnType<typeof createClient>,
  dataQuery: DataQuery,
  workspaceId: string,
): Promise<{ data: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  let query = supabase
    .from('cached_time_entries')
    .select('clickup_id, task_id, user_id, duration, start_time, end_time, description, billable')
    .eq('workspace_id', workspaceId);

  const filters = dataQuery.filters ?? {};

  if (filters.date_range && typeof filters.date_range === 'object') {
    const range = filters.date_range as { start?: string; end?: string };
    if (range.start) query = query.gte('start_time', range.start);
    if (range.end) query = query.lte('start_time', range.end);
  }

  const limit = Math.min(dataQuery.limit ?? 500, 500);
  query = query.limit(limit);

  const { data: entries, error } = await query;

  if (error) {
    return { data: [], summary: { error: error.message } };
  }

  const allEntries = entries ?? [];

  // Fetch team members for grouping by member
  const { data: members } = await supabase
    .from('cached_team_members')
    .select('clickup_id, username')
    .eq('workspace_id', workspaceId);

  const memberMap = new Map((members ?? []).map((m) => [m.clickup_id, m.username]));

  const groupBy = dataQuery.group_by ?? 'member';
  const grouped: Record<string, number> = {};

  for (const entry of allEntries) {
    let key: string;
    const durationHours = (entry.duration as number) / 3600000; // ms to hours

    switch (groupBy) {
      case 'member':
        key = memberMap.get(entry.user_id as string) ?? 'Unknown';
        break;
      case 'task':
        key = entry.task_id as string;
        break;
      case 'day': {
        const d = new Date(entry.start_time as string);
        key = d.toISOString().split('T')[0];
        break;
      }
      case 'week': {
        const d = new Date(entry.start_time as string);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = `Week of ${weekStart.toISOString().split('T')[0]}`;
        break;
      }
      default:
        key = memberMap.get(entry.user_id as string) ?? 'Unknown';
    }

    grouped[key] = (grouped[key] || 0) + durationHours;
  }

  const data = Object.entries(grouped).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }));

  if (dataQuery.sort_by === 'value_desc') {
    data.sort((a, b) => b.value - a.value);
  } else if (dataQuery.sort_by === 'value_asc') {
    data.sort((a, b) => a.value - b.value);
  }

  return {
    data,
    summary: {
      total_entries: allEntries.length,
      total_hours: Math.round(data.reduce((s, d) => s + d.value, 0) * 100) / 100,
      groups: data.length,
      group_by: groupBy,
      data_source: 'time_entries',
    },
  };
}

async function queryTeamData(
  supabase: ReturnType<typeof createClient>,
  dataQuery: DataQuery,
  workspaceId: string,
): Promise<{ data: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  // Get team members with their task counts
  const [{ data: members }, { data: tasks }] = await Promise.all([
    supabase
      .from('cached_team_members')
      .select('clickup_id, username, email, role')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_tasks')
      .select('assignees, status')
      .eq('workspace_id', workspaceId),
  ]);

  const allMembers = members ?? [];
  const allTasks = tasks ?? [];

  // Calculate task counts per member
  const taskCounts: Record<string, number> = {};
  for (const task of allTasks) {
    const assignees = Array.isArray(task.assignees) ? task.assignees : [];
    for (const a of assignees) {
      const name = (a as { username?: string }).username ?? 'Unknown';
      taskCounts[name] = (taskCounts[name] || 0) + 1;
    }
  }

  const data = allMembers.map((m) => ({
    name: m.username as string,
    value: taskCounts[m.username as string] ?? 0,
  }));

  if (dataQuery.sort_by === 'value_desc') {
    data.sort((a, b) => b.value - a.value);
  }

  return {
    data,
    summary: {
      total_members: allMembers.length,
      data_source: 'team_members',
    },
  };
}

async function queryHealthData(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<{ data: Record<string, unknown>[]; summary: Record<string, unknown> }> {
  const { data: result } = await supabase
    .from('health_check_results')
    .select('overall_score, category_scores, issues, checked_at')
    .eq('workspace_id', workspaceId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  if (!result) {
    return { data: [], summary: { note: 'No health check results found' } };
  }

  const categoryScores = (result.category_scores ?? {}) as Record<string, number>;
  const data = Object.entries(categoryScores).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    data,
    summary: {
      overall_score: result.overall_score,
      checked_at: result.checked_at,
      issue_count: Array.isArray(result.issues) ? result.issues.length : 0,
      data_source: 'health',
    },
  };
}

// ---------------------------------------------------------------------------
// create_dashboard_widget
// ---------------------------------------------------------------------------

export async function handleCreateDashboardWidget(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const widgetTypeRaw = input.widget_type as string;
  const title = input.title as string;
  const dataQuery = (input.data_query as DataQuery) ?? {};
  const config = (input.config as Record<string, unknown>) ?? {};
  const dashboardId = input.dashboard_id as string | undefined;
  const dashboardName = (input.dashboard_name as string) ?? 'My Dashboard';

  if (!widgetTypeRaw || !title) {
    return { error: 'widget_type and title are required', success: false };
  }

  // Validate widget type
  const widgetType = resolveWidgetType(widgetTypeRaw);
  if (!widgetType) {
    return {
      error: `Unsupported widget type "${widgetTypeRaw}". Supported types: ${SUPPORTED_WIDGET_TYPES.join(', ')}`,
      success: false,
    };
  }

  // Query cached data based on data_query to generate preview info
  let queryResult: { data: Record<string, unknown>[]; summary: Record<string, unknown> } = {
    data: [],
    summary: {},
  };
  if (dataQuery.data_source) {
    queryResult = await executeDataQuery(dataQuery, workspaceId);
  }

  // Build the full config_json by merging user config with data query results
  const configJson: Record<string, unknown> = {
    ...config,
    data_source: dataQuery.data_source ?? config.data_source ?? 'tasks',
    metric: dataQuery.metric ?? config.metric ?? 'count',
    group_by: dataQuery.group_by ?? config.group_by ?? 'status',
    filters: dataQuery.filters ?? config.filters ?? {},
    sort_by: dataQuery.sort_by ?? config.sort_by,
  };

  // Find or create the target dashboard
  let resolvedDashboardId: string;

  if (dashboardId) {
    // Verify dashboard exists
    const { data: existing } = await supabase
      .from('dashboards')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', dashboardId)
      .single();

    if (!existing) {
      return { error: `Dashboard with id "${dashboardId}" not found`, success: false };
    }
    resolvedDashboardId = existing.id;
  } else {
    // Find by name or create
    const { data: existingDashboard } = await supabase
      .from('dashboards')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${dashboardName}%`)
      .limit(1)
      .single();

    if (existingDashboard) {
      resolvedDashboardId = existingDashboard.id;
    } else {
      const { data: newDashboard, error: createError } = await supabase
        .from('dashboards')
        .insert({
          workspace_id: workspaceId,
          name: dashboardName,
          description: 'Created by Binee',
          created_by: 'system',
          is_default: false,
        })
        .select('id')
        .single();

      if (createError || !newDashboard) {
        return { error: `Failed to create dashboard: ${createError?.message}`, success: false };
      }
      resolvedDashboardId = newDashboard.id;
    }
  }

  // Determine widget position based on existing widget count
  const { count } = await supabase
    .from('dashboard_widgets')
    .select('id', { count: 'exact', head: true })
    .eq('dashboard_id', resolvedDashboardId);

  const widgetCount = count ?? 0;

  // Layout: summary cards are 4×2, others 4×3, 3 columns per row
  const isSummary = widgetType === 'summary';
  const w = isSummary ? 4 : 4;
  const h = isSummary ? 2 : 3;
  const col = (widgetCount % 3) * 4;
  const row = Math.floor(widgetCount / 3) * 3;

  // Save widget
  const { data: widget, error: widgetError } = await supabase
    .from('dashboard_widgets')
    .insert({
      workspace_id: workspaceId,
      dashboard_id: resolvedDashboardId,
      type: widgetType,
      title,
      config: configJson,
      position: { x: col, y: row, w, h },
    })
    .select('id, type, title')
    .single();

  if (widgetError || !widget) {
    return { error: `Failed to create widget: ${widgetError?.message}`, success: false };
  }

  // Get dashboard name for response
  const { data: dashboardRecord } = await supabase
    .from('dashboards')
    .select('name')
    .eq('id', resolvedDashboardId)
    .single();

  const resolvedName = dashboardRecord?.name ?? dashboardName;

  return {
    success: true,
    widget: {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      dashboard_id: resolvedDashboardId,
      dashboard: resolvedName,
      position: { x: col, y: row, w, h },
    },
    preview: {
      data_points: queryResult.data.length,
      sample: queryResult.data.slice(0, 5),
      summary: queryResult.summary,
    },
    message: `Widget "${title}" (${widgetType}) added to dashboard "${resolvedName}". You can view it on the Dashboards page.`,
  };
}

// ---------------------------------------------------------------------------
// update_dashboard_widget
// ---------------------------------------------------------------------------

export async function handleUpdateDashboardWidget(
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
    const resolvedType = resolveWidgetType(input.widget_type as string);
    if (!resolvedType) {
      return {
        error: `Unsupported widget type "${input.widget_type}". Supported types: ${SUPPORTED_WIDGET_TYPES.join(', ')}`,
        success: false,
      };
    }
    updates.type = resolvedType;
  }

  if (input.config && typeof input.config === 'object') {
    updates.config = {
      ...(existing.config as Record<string, unknown>),
      ...(input.config as Record<string, unknown>),
    };
  }

  // If data_query is provided, re-query and merge into config
  if (input.data_query && typeof input.data_query === 'object') {
    const dataQuery = input.data_query as DataQuery;
    const existingConfig = (updates.config ?? existing.config) as Record<string, unknown>;
    updates.config = {
      ...existingConfig,
      data_source: dataQuery.data_source ?? existingConfig.data_source,
      metric: dataQuery.metric ?? existingConfig.metric,
      group_by: dataQuery.group_by ?? existingConfig.group_by,
      filters: dataQuery.filters ?? existingConfig.filters,
      sort_by: dataQuery.sort_by ?? existingConfig.sort_by,
    };
  }

  const { error: updateError } = await supabase
    .from('dashboard_widgets')
    .update(updates)
    .eq('id', widgetId)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    return { error: `Failed to update widget: ${updateError.message}`, success: false };
  }

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
// delete_dashboard_widget
// ---------------------------------------------------------------------------

export async function handleDeleteDashboardWidget(
  input: Record<string, unknown>,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const widgetId = input.widget_id as string;

  if (!widgetId) {
    return { error: 'widget_id is required', success: false };
  }

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
// list_dashboards
// ---------------------------------------------------------------------------

export async function handleListDashboards(
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
// list_dashboard_widgets
// ---------------------------------------------------------------------------

export async function handleListDashboardWidgets(
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
