// Workspace metrics computation — uses mock data for now

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
  totalTimeTracked7d: number; // hours
  totalTimeTracked30d: number; // hours
  activeMembers7d: number;
  totalMembers: number;
  abandonedLists: number;
  totalLists: number;
  tasksCreated7d: number;
  tasksClosed7d: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
}

const mockMetrics: WorkspaceMetrics = {
  totalTasks: 342,
  activeTasks: 187,
  completedTasks7d: 34,
  completedTasks30d: 128,
  overdueTasks: 23,
  unassignedTasks: 15,
  tasksDueToday: 8,
  tasksDueThisWeek: 31,
  avgTaskAgeDays: 12.4,
  totalTimeTracked7d: 156,
  totalTimeTracked30d: 612,
  activeMembers7d: 9,
  totalMembers: 12,
  abandonedLists: 3,
  totalLists: 24,
  tasksCreated7d: 41,
  tasksClosed7d: 34,
  velocityTrend: 'improving',
};

export async function computeWorkspaceMetrics(
  _workspaceId: string
): Promise<WorkspaceMetrics> {
  // Simulate async fetch
  await new Promise((r) => setTimeout(r, 200));
  return { ...mockMetrics };
}
