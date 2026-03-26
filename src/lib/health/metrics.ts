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

function getEmptyMetrics(): WorkspaceMetrics {
  return {
    totalTasks: 0,
    activeTasks: 0,
    completedTasks7d: 0,
    completedTasks30d: 0,
    overdueTasks: 0,
    unassignedTasks: 0,
    tasksDueToday: 0,
    tasksDueThisWeek: 0,
    avgTaskAgeDays: 0,
    totalTimeTracked7d: 0,
    totalTimeTracked30d: 0,
    activeMembers7d: 0,
    totalMembers: 0,
    abandonedLists: 0,
    totalLists: 0,
    tasksCreated7d: 0,
    tasksClosed7d: 0,
    velocityTrend: 'stable',
  };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function computeWorkspaceMetrics(
  workspaceId: string,
): Promise<WorkspaceMetrics> {
  const supabase = getSupabaseAdmin();

  // Return empty metrics when Supabase is not configured
  if (!supabase) {
    return getEmptyMetrics();
  }

  // Use the SQL RPC that does all aggregation server-side in a single query
  // instead of fetching every row and filtering in JavaScript.
  const { data, error } = await supabase.rpc('compute_workspace_metrics_rpc', {
    p_workspace_id: workspaceId,
  });

  if (error || !data) {
    console.error('computeWorkspaceMetrics RPC failed, returning empty metrics:', error?.message);
    return getEmptyMetrics();
  }

  return {
    totalTasks: data.totalTasks ?? 0,
    activeTasks: data.activeTasks ?? 0,
    completedTasks7d: data.completedTasks7d ?? 0,
    completedTasks30d: data.completedTasks30d ?? 0,
    overdueTasks: data.overdueTasks ?? 0,
    unassignedTasks: data.unassignedTasks ?? 0,
    tasksDueToday: data.tasksDueToday ?? 0,
    tasksDueThisWeek: data.tasksDueThisWeek ?? 0,
    avgTaskAgeDays: data.avgTaskAgeDays ?? 0,
    totalTimeTracked7d: data.totalTimeTracked7d ?? 0,
    totalTimeTracked30d: data.totalTimeTracked30d ?? 0,
    activeMembers7d: data.activeMembers7d ?? 0,
    totalMembers: data.totalMembers ?? 0,
    abandonedLists: data.abandonedLists ?? 0,
    totalLists: data.totalLists ?? 0,
    tasksCreated7d: data.tasksCreated7d ?? 0,
    tasksClosed7d: data.tasksClosed7d ?? 0,
    velocityTrend: (data.velocityTrend as 'improving' | 'stable' | 'declining') ?? 'stable',
  };
}
