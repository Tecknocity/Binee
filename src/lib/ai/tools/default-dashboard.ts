import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Default "Project Overview" dashboard — created automatically on ClickUp sync.
// Zero AI credits — this is pure code.
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

const DEFAULT_WIDGETS = [
  {
    title: 'Total Active Tasks',
    widget_type: 'summary',
    position: 0,
    data_query: { data_source: 'tasks', metric: 'count', filters: { status: 'active' } },
    config: {},
  },
  {
    title: 'Overdue Tasks',
    widget_type: 'summary',
    position: 1,
    data_query: { data_source: 'tasks', metric: 'count', filters: { overdue: true } },
    config: { color: 'red' },
  },
  {
    title: 'Completion Rate (30d)',
    widget_type: 'summary',
    position: 2,
    data_query: { data_source: 'tasks', metric: 'completion_rate', filters: { date_range: { preset: 'last_30_days' } } },
    config: { format: 'percentage' },
  },
  {
    title: 'Team Members',
    widget_type: 'summary',
    position: 3,
    data_query: { data_source: 'team_members', metric: 'count' },
    config: {},
  },
  {
    title: 'Tasks by Status',
    widget_type: 'bar',
    position: 4,
    data_query: { data_source: 'tasks', metric: 'count', group_by: 'status' },
    config: {},
  },
  {
    title: 'Tasks by Assignee',
    widget_type: 'bar',
    position: 5,
    data_query: { data_source: 'tasks', metric: 'count', group_by: 'assignee' },
    config: {},
  },
  {
    title: 'Tasks by Priority',
    widget_type: 'donut',
    position: 6,
    data_query: { data_source: 'tasks', metric: 'count', group_by: 'priority' },
    config: {},
  },
  {
    title: 'Task Completion Trend (30d)',
    widget_type: 'line',
    position: 7,
    data_query: { data_source: 'tasks', metric: 'count', group_by: 'week', filters: { status: 'closed', date_range: { preset: 'last_30_days' } } },
    config: {},
  },
  {
    title: 'Overdue Tasks',
    widget_type: 'table',
    position: 8,
    data_query: { data_source: 'tasks', metric: 'count', filters: { overdue: true }, sort_by: 'value_desc' },
    config: { columns: ['name', 'assignee', 'due_date', 'days_overdue', 'list'] },
  },
  {
    title: 'Recent Activity',
    widget_type: 'activity',
    position: 9,
    data_query: { data_source: 'tasks', metric: 'count', filters: { date_range: { preset: 'last_7_days' } } },
    config: { limit: 20 },
  },
];

/**
 * Create a default "Project Overview" dashboard with 10 standard widgets
 * for the given workspace. Skips if one already exists.
 */
export async function createDefaultDashboard(workspaceId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Check if a "Project Overview" dashboard already exists
  const { data: existing } = await supabase
    .from('dashboards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', 'Project Overview')
    .limit(1)
    .single();

  if (existing) {
    console.log('[default-dashboard] Project Overview already exists, skipping');
    return;
  }

  // Create the dashboard
  const { data: dashboard, error: dashErr } = await supabase
    .from('dashboards')
    .insert({
      workspace_id: workspaceId,
      name: 'Project Overview',
      description: 'Default project overview with key metrics and charts',
    })
    .select('id')
    .single();

  if (dashErr || !dashboard) {
    console.error('[default-dashboard] Failed to create dashboard:', dashErr?.message);
    return;
  }

  // Create all default widgets
  const widgets = DEFAULT_WIDGETS.map((w) => ({
    dashboard_id: dashboard.id,
    workspace_id: workspaceId,
    ...w,
  }));

  const { error: widgetErr } = await supabase
    .from('dashboard_widgets')
    .insert(widgets);

  if (widgetErr) {
    console.error('[default-dashboard] Failed to create widgets:', widgetErr.message);
    return;
  }

  console.log(`[default-dashboard] Created Project Overview with ${widgets.length} widgets for workspace ${workspaceId}`);
}
