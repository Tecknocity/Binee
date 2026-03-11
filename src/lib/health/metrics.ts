import { createClient } from '@supabase/supabase-js';

export interface WorkspaceMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks7d: number;
  completedTasks30d: number;
  overdueTasks: number;
  unassignedTasks: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  avgTaskAgeDays: number;
  totalTimeTracked7d: number;
  totalTimeTracked30d: number;
  activeMembers7d: number;
  totalMembers: number;
  abandonedLists: number;
  totalLists: number;
  tasksCreated7d: number;
  tasksClosed7d: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function computeWorkspaceMetrics(
  workspaceId: string,
): Promise<WorkspaceMetrics> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const nowISO = now.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  // Fetch all tasks
  const { data: allTasks } = await supabase
    .from('cached_tasks')
    .select('clickup_id, status, assignees, due_date, created_at, updated_at')
    .eq('workspace_id', workspaceId);

  const tasks = allTasks ?? [];
  const totalTasks = tasks.length;

  const openStatuses = tasks.filter(
    (t) => t.status && !t.status.toLowerCase().includes('closed') && !t.status.toLowerCase().includes('complete'),
  );
  const activeTasks = openStatuses.length;

  const overdueTasks = openStatuses.filter(
    (t) => t.due_date && t.due_date < nowISO,
  ).length;

  const unassignedTasks = openStatuses.filter(
    (t) => !t.assignees || (Array.isArray(t.assignees) && t.assignees.length === 0),
  ).length;

  const tasksDueToday = openStatuses.filter(
    (t) => t.due_date && t.due_date >= todayStart && t.due_date < new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
  ).length;

  const tasksDueThisWeek = openStatuses.filter(
    (t) => t.due_date && t.due_date >= todayStart && t.due_date < weekEnd,
  ).length;

  const completedTasks7d = tasks.filter(
    (t) => t.status && (t.status.toLowerCase().includes('closed') || t.status.toLowerCase().includes('complete')) && t.updated_at >= sevenDaysAgo,
  ).length;

  const completedTasks30d = tasks.filter(
    (t) => t.status && (t.status.toLowerCase().includes('closed') || t.status.toLowerCase().includes('complete')) && t.updated_at >= thirtyDaysAgo,
  ).length;

  const tasksCreated7d = tasks.filter((t) => t.created_at >= sevenDaysAgo).length;
  const tasksClosed7d = completedTasks7d;

  const taskAges = openStatuses
    .map((t) => (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24))
    .filter((age) => !isNaN(age));
  const avgTaskAgeDays = taskAges.length > 0
    ? Math.round((taskAges.reduce((a, b) => a + b, 0) / taskAges.length) * 10) / 10
    : 0;

  // Fetch members
  const { count: memberCount } = await supabase
    .from('cached_team_members')
    .select('clickup_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const totalMembers = memberCount ?? 0;

  // Active members: those with tasks updated in last 7 days
  const activeMemberIds = new Set<string>();
  for (const task of tasks) {
    if (task.updated_at >= sevenDaysAgo && task.assignees && Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        const id = typeof assignee === 'object' && assignee !== null ? (assignee as { id?: string }).id : String(assignee);
        if (id) activeMemberIds.add(String(id));
      }
    }
  }
  const activeMembers7d = Math.min(activeMemberIds.size, totalMembers);

  // Lists
  const { data: lists } = await supabase
    .from('cached_lists')
    .select('clickup_id, updated_at')
    .eq('workspace_id', workspaceId);

  const allLists = lists ?? [];
  const totalLists = allLists.length;
  const abandonedLists = allLists.filter((l) => l.updated_at < thirtyDaysAgo).length;

  // Time tracking
  const { data: timeEntries7d } = await supabase
    .from('cached_time_entries')
    .select('duration')
    .eq('workspace_id', workspaceId)
    .gte('start_time', sevenDaysAgo);

  const totalTimeTracked7d = (timeEntries7d ?? []).reduce(
    (sum, e) => sum + (typeof e.duration === 'number' ? e.duration : 0),
    0,
  ) / 3_600_000;

  const { data: timeEntries30d } = await supabase
    .from('cached_time_entries')
    .select('duration')
    .eq('workspace_id', workspaceId)
    .gte('start_time', thirtyDaysAgo);

  const totalTimeTracked30d = (timeEntries30d ?? []).reduce(
    (sum, e) => sum + (typeof e.duration === 'number' ? e.duration : 0),
    0,
  ) / 3_600_000;

  // Velocity trend
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const closedLast4Weeks = tasks.filter(
    (t) => t.status && (t.status.toLowerCase().includes('closed') || t.status.toLowerCase().includes('complete')) && t.updated_at >= fourWeeksAgo,
  ).length;
  const avgWeeklyVelocity = closedLast4Weeks / 4;
  let velocityTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (tasksClosed7d > avgWeeklyVelocity * 1.15) velocityTrend = 'improving';
  else if (tasksClosed7d < avgWeeklyVelocity * 0.85) velocityTrend = 'declining';

  return {
    totalTasks,
    activeTasks,
    completedTasks7d,
    completedTasks30d,
    overdueTasks,
    unassignedTasks,
    tasksDueToday,
    tasksDueThisWeek,
    avgTaskAgeDays,
    totalTimeTracked7d: Math.round(totalTimeTracked7d * 100) / 100,
    totalTimeTracked30d: Math.round(totalTimeTracked30d * 100) / 100,
    activeMembers7d,
    totalMembers,
    abandonedLists,
    totalLists,
    tasksCreated7d,
    tasksClosed7d,
    velocityTrend,
  };
}
