'use client';

import { useState, useCallback } from 'react';
import type { Dashboard, DashboardWidget } from '@/types/database';

// ----- Mock data -----

const mockDashboards: Dashboard[] = [
  {
    id: 'dash-1',
    workspace_id: 'mock-workspace',
    name: 'Project Overview',
    description: 'Key project metrics and team performance',
    layout: [],
    is_default: true,
    created_by: 'user-1',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'dash-2',
    workspace_id: 'mock-workspace',
    name: 'Sprint Tracker',
    description: 'Current sprint progress and velocity',
    layout: [],
    is_default: false,
    created_by: 'user-1',
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-09T15:45:00Z',
  },
];

const mockWidgets: DashboardWidget[] = [
  {
    id: 'widget-1',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'summary',
    title: 'Active Tasks',
    config: {
      dataSource: 'tasks',
      metric: 'count',
      filter: 'active',
      icon: 'CheckSquare',
      value: 187,
      change: 12,
      changeDirection: 'up',
    },
    position: { x: 0, y: 0, w: 1, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-2',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'summary',
    title: 'Overdue Tasks',
    config: {
      dataSource: 'tasks',
      metric: 'count',
      filter: 'overdue',
      icon: 'AlertTriangle',
      value: 23,
      change: -8,
      changeDirection: 'down',
    },
    position: { x: 1, y: 0, w: 1, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-3',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'summary',
    title: 'Completion Rate',
    config: {
      dataSource: 'tasks',
      metric: 'percentage',
      filter: 'completion_rate',
      icon: 'TrendingUp',
      value: 82.9,
      suffix: '%',
      change: 5.2,
      changeDirection: 'up',
    },
    position: { x: 2, y: 0, w: 1, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-4',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'summary',
    title: 'Team Velocity',
    config: {
      dataSource: 'tasks',
      metric: 'count',
      filter: 'velocity',
      icon: 'Zap',
      value: 34,
      suffix: '/wk',
      change: 3,
      changeDirection: 'up',
    },
    position: { x: 3, y: 0, w: 1, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-5',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'bar',
    title: 'Tasks Completed by Member',
    config: {
      dataSource: 'tasks',
      metric: 'count',
      groupBy: 'assignee',
      timeRange: '30d',
    },
    position: { x: 0, y: 1, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-6',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'line',
    title: 'Tasks Completed Over Time',
    config: {
      dataSource: 'tasks',
      metric: 'count',
      groupBy: 'week',
      timeRange: '8w',
    },
    position: { x: 2, y: 1, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-7',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'table',
    title: 'Overdue Tasks',
    config: {
      dataSource: 'tasks',
      filter: 'overdue',
      columns: ['name', 'assignee', 'due_date', 'priority', 'list'],
      timeRange: '30d',
    },
    position: { x: 0, y: 2, w: 3, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-8',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'donut',
    title: 'Task Status Distribution',
    config: { dataSource: 'tasks', metric: 'count', groupBy: 'status' },
    position: { x: 0, y: 3, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-9',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'time_tracking',
    title: 'Hours Logged This Week',
    config: { dataSource: 'time_entries', metric: 'hours', groupBy: 'day', timeRange: '7d' },
    position: { x: 2, y: 3, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-10',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'workload',
    title: 'Team Workload',
    config: { dataSource: 'tasks', metric: 'count', groupBy: 'assignee' },
    position: { x: 0, y: 4, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-11',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'priority',
    title: 'Priority Breakdown by List',
    config: { dataSource: 'tasks', metric: 'count', groupBy: 'priority' },
    position: { x: 2, y: 4, w: 2, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-12',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'progress',
    title: 'Sprint & Milestone Progress',
    config: { dataSource: 'tasks', metric: 'progress' },
    position: { x: 0, y: 5, w: 3, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
  {
    id: 'widget-13',
    workspace_id: 'mock-workspace',
    dashboard_id: 'dash-1',
    type: 'activity',
    title: 'Recent Activity',
    config: { dataSource: 'tasks', metric: 'activity' },
    position: { x: 0, y: 6, w: 3, h: 1 },
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-03-10T08:30:00Z',
  },
];

// ----- New widget mock data generators -----

export function getTaskStatusData() {
  return [
    { name: 'In Progress', value: 64 },
    { name: 'To Do', value: 52 },
    { name: 'In Review', value: 28 },
    { name: 'Done', value: 34 },
    { name: 'Blocked', value: 9 },
  ];
}

export function getSprintProgressData() {
  return [
    { name: 'Sprint 14 — Auth Revamp', completed: 18, total: 22, expectedPct: 75, daysLeft: 4 },
    { name: 'Sprint 15 — Dashboard V2', completed: 8, total: 26, expectedPct: 30, daysLeft: 11 },
    { name: 'Q1 Milestone — Beta Launch', completed: 142, total: 180, expectedPct: 80, daysLeft: 16 },
  ];
}

export function getTimeTrackingData() {
  return [
    { day: 'Mon', hours: 28.5 },
    { day: 'Tue', hours: 32.0 },
    { day: 'Wed', hours: 26.5 },
    { day: 'Thu', hours: 34.0 },
    { day: 'Fri', hours: 30.5 },
    { day: 'Sat', hours: 4.0 },
    { day: 'Sun', hours: 1.0 },
  ];
}

export function getWorkloadData() {
  return [
    { name: 'Sarah K.', completed: 12, inProgress: 8, overdue: 2, total: 22 },
    { name: 'James M.', completed: 9, inProgress: 10, overdue: 4, total: 23 },
    { name: 'Emily R.', completed: 14, inProgress: 5, overdue: 1, total: 20 },
    { name: 'David L.', completed: 7, inProgress: 9, overdue: 3, total: 19 },
    { name: 'Maria C.', completed: 10, inProgress: 6, overdue: 2, total: 18 },
  ];
}

export function getPriorityBreakdownData() {
  return [
    { list: 'Backend', urgent: 3, high: 8, normal: 14, low: 5 },
    { list: 'Frontend', urgent: 1, high: 6, normal: 18, low: 8 },
    { list: 'Design', urgent: 0, high: 4, normal: 10, low: 6 },
    { list: 'Bugs', urgent: 5, high: 9, normal: 7, low: 2 },
    { list: 'Infra', urgent: 2, high: 5, normal: 6, low: 3 },
  ];
}

export function getRecentActivityData() {
  return [
    { id: 'a1', type: 'completed', user: 'Sarah K.', action: 'completed', target: 'Implement OAuth flow', time: '12 min ago' },
    { id: 'a2', type: 'commented', user: 'James M.', action: 'commented on', target: 'API rate limiting PR', time: '28 min ago' },
    { id: 'a3', type: 'flagged', user: 'Emily R.', action: 'flagged', target: 'Login redirect bug', time: '45 min ago' },
    { id: 'a4', type: 'created', user: 'David L.', action: 'created', target: 'Database migration task', time: '1h ago' },
    { id: 'a5', type: 'assigned', user: 'Maria C.', action: 'was assigned to', target: 'Review onboarding flow', time: '1.5h ago' },
    { id: 'a6', type: 'completed', user: 'James M.', action: 'completed', target: 'Fix pagination offset', time: '2h ago' },
    { id: 'a7', type: 'updated', user: 'Sarah K.', action: 'updated due date for', target: 'Design system tokens', time: '2.5h ago' },
    { id: 'a8', type: 'commented', user: 'David L.', action: 'commented on', target: 'Staging deploy config', time: '3h ago' },
  ];
}

// ----- Chart data generators -----

export function getBarChartData() {
  return [
    { name: 'Sarah K.', completed: 28, color: '#854DF9' },
    { name: 'James M.', completed: 24, color: '#9D6FFA' },
    { name: 'Emily R.', completed: 21, color: '#854DF9' },
    { name: 'David L.', completed: 18, color: '#9D6FFA' },
    { name: 'Maria C.', completed: 15, color: '#854DF9' },
  ];
}

export function getLineChartData() {
  return [
    { week: 'Jan 13', completed: 22 },
    { week: 'Jan 20', completed: 28 },
    { week: 'Jan 27', completed: 25 },
    { week: 'Feb 3', completed: 31 },
    { week: 'Feb 10', completed: 27 },
    { week: 'Feb 17', completed: 35 },
    { week: 'Feb 24', completed: 30 },
    { week: 'Mar 3', completed: 34 },
  ];
}

export interface OverdueTask {
  id: string;
  name: string;
  assignee: string;
  dueDate: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  list: string;
  daysOverdue: number;
}

export function getOverdueTasksData(): OverdueTask[] {
  return [
    { id: 't1', name: 'Update API documentation', assignee: 'James M.', dueDate: '2026-03-04', priority: 'high', list: 'Backend', daysOverdue: 7 },
    { id: 't2', name: 'Fix login redirect bug', assignee: 'Emily R.', dueDate: '2026-03-06', priority: 'urgent', list: 'Bugs', daysOverdue: 5 },
    { id: 't3', name: 'Design onboarding flow v2', assignee: 'Sarah K.', dueDate: '2026-03-07', priority: 'high', list: 'Design', daysOverdue: 4 },
    { id: 't4', name: 'Write unit tests for billing', assignee: 'David L.', dueDate: '2026-03-08', priority: 'normal', list: 'Backend', daysOverdue: 3 },
    { id: 't5', name: 'Migrate database schema', assignee: 'James M.', dueDate: '2026-03-08', priority: 'urgent', list: 'Infrastructure', daysOverdue: 3 },
    { id: 't6', name: 'Review PR #342', assignee: 'Maria C.', dueDate: '2026-03-09', priority: 'normal', list: 'Code Review', daysOverdue: 2 },
    { id: 't7', name: 'Update privacy policy page', assignee: 'Sarah K.', dueDate: '2026-03-09', priority: 'low', list: 'Legal', daysOverdue: 2 },
    { id: 't8', name: 'Set up staging environment', assignee: 'David L.', dueDate: '2026-03-10', priority: 'high', list: 'Infrastructure', daysOverdue: 1 },
    { id: 't9', name: 'Optimize image loading', assignee: 'Emily R.', dueDate: '2026-03-10', priority: 'normal', list: 'Frontend', daysOverdue: 1 },
    { id: 't10', name: 'Create weekly report template', assignee: 'Maria C.', dueDate: '2026-03-10', priority: 'low', list: 'Operations', daysOverdue: 1 },
  ];
}

// ----- Hook -----

export interface DashboardState {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  widgets: DashboardWidget[];
  isLoading: boolean;
  setActiveDashboard: (id: string) => void;
  createDashboard: (name: string) => void;
  deleteDashboard: (id: string) => void;
  addWidget: (config: Partial<DashboardWidget>) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, config: Partial<DashboardWidget>) => void;
}

export function useDashboard(): DashboardState {
  const [dashboards, setDashboards] = useState<Dashboard[]>(mockDashboards);
  const [activeDashboardId, setActiveDashboardId] = useState<string>('dash-1');
  const [widgets, setWidgets] = useState<DashboardWidget[]>(mockWidgets);
  const [isLoading] = useState(false);

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId) ?? null;

  const setActiveDashboard = useCallback((id: string) => {
    setActiveDashboardId(id);
  }, []);

  const createDashboard = useCallback((name: string) => {
    const newDash: Dashboard = {
      id: `dash-${Date.now()}`,
      workspace_id: 'mock-workspace',
      name,
      description: null,
      layout: [],
      is_default: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDashboards((prev) => [...prev, newDash]);
    setActiveDashboardId(newDash.id);
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    setWidgets((prev) => prev.filter((w) => w.dashboard_id !== id));
  }, []);

  const addWidget = useCallback(
    (config: Partial<DashboardWidget>) => {
      const newWidget: DashboardWidget = {
        id: `widget-${Date.now()}`,
        workspace_id: 'mock-workspace',
        dashboard_id: activeDashboardId,
        type: config.type ?? 'summary',
        title: config.title ?? 'New Widget',
        config: config.config ?? {},
        position: config.position ?? { x: 0, y: 0, w: 1, h: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWidgets((prev) => [...prev, newWidget]);
    },
    [activeDashboardId]
  );

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWidget = useCallback((id: string, config: Partial<DashboardWidget>) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...config, updated_at: new Date().toISOString() } : w))
    );
  }, []);

  const activeWidgets = widgets.filter((w) => w.dashboard_id === activeDashboardId);

  return {
    dashboards,
    activeDashboard,
    widgets: activeWidgets,
    isLoading,
    setActiveDashboard,
    createDashboard,
    deleteDashboard,
    addWidget,
    removeWidget,
    updateWidget,
  };
}
