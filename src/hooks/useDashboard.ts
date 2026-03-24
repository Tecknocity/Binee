'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import type { Dashboard, DashboardWidget } from '@/types/database';

// ---------------------------------------------------------------------------
// Types for cached data
// ---------------------------------------------------------------------------

interface CachedTask {
  clickup_id: string;
  list_id: string;
  name: string;
  status: string | null;
  priority: number | null;
  assignees: { id?: string; username?: string }[] | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  time_spent: number | null;
}

interface CachedTimeEntry {
  duration: number;
  start_time: string;
  user_id: string;
}

interface CachedTeamMember {
  clickup_id: string;
  username: string;
}

interface CachedList {
  clickup_id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Real data fetchers — query Supabase cached tables
// ---------------------------------------------------------------------------

const supabase = createBrowserClient();

export function useTaskStatusData(workspaceId: string | null) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('status')
        .eq('workspace_id', workspaceId);
      if (!tasks || tasks.length === 0) { setData([]); setLoading(false); return; }
      const counts: Record<string, number> = {};
      for (const t of tasks) {
        const s = t.status ?? 'Unknown';
        counts[s] = (counts[s] ?? 0) + 1;
      }
      setData(Object.entries(counts).map(([name, value]) => ({ name, value })));
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useSprintProgressData(workspaceId: string | null) {
  const [data, setData] = useState<{ name: string; completed: number; total: number; expectedPct: number; daysLeft: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: lists } = await supabase
        .from('cached_lists')
        .select('clickup_id, name')
        .eq('workspace_id', workspaceId);
      if (!lists || lists.length === 0) { setData([]); setLoading(false); return; }

      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('list_id, status')
        .eq('workspace_id', workspaceId);

      const items = lists.slice(0, 5).map((list) => {
        const listTasks = (tasks ?? []).filter((t) => t.list_id === list.clickup_id);
        const completed = listTasks.filter((t) =>
          t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('closed')
        ).length;
        return {
          name: list.name,
          completed,
          total: listTasks.length,
          expectedPct: listTasks.length > 0 ? Math.round((completed / listTasks.length) * 100) : 0,
          daysLeft: 0,
        };
      }).filter((item) => item.total > 0);
      setData(items);
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useTimeTrackingData(workspaceId: string | null) {
  const [data, setData] = useState<{ day: string; hours: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: entries } = await supabase
        .from('cached_time_entries')
        .select('duration, start_time')
        .eq('workspace_id', workspaceId)
        .gte('start_time', sevenDaysAgo);

      if (!entries || entries.length === 0) { setData([]); setLoading(false); return; }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayHours: Record<string, number> = {};
      for (const e of entries) {
        const day = dayNames[new Date(e.start_time).getDay()];
        dayHours[day] = (dayHours[day] ?? 0) + (e.duration / 3_600_000);
      }
      const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      setData(orderedDays.map((day) => ({ day, hours: Math.round((dayHours[day] ?? 0) * 10) / 10 })));
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useWorkloadData(workspaceId: string | null) {
  const [data, setData] = useState<{ name: string; completed: number; inProgress: number; overdue: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('status, assignees, due_date')
        .eq('workspace_id', workspaceId) as { data: CachedTask[] | null };

      const { data: members } = await supabase
        .from('cached_team_members')
        .select('clickup_id, username')
        .eq('workspace_id', workspaceId);

      if (!tasks || tasks.length === 0 || !members) { setData([]); setLoading(false); return; }

      const now = new Date().toISOString();
      const memberMap = new Map(members.map((m) => [m.clickup_id, m.username]));
      const workload: Record<string, { completed: number; inProgress: number; overdue: number; total: number }> = {};

      for (const task of tasks) {
        const assignees = Array.isArray(task.assignees) ? task.assignees : [];
        for (const a of assignees) {
          const id = typeof a === 'object' && a !== null ? a.id : String(a);
          if (!id) continue;
          const name = memberMap.get(String(id)) ?? String(id);
          if (!workload[name]) workload[name] = { completed: 0, inProgress: 0, overdue: 0, total: 0 };
          workload[name].total++;
          const isComplete = task.status?.toLowerCase().includes('complete') || task.status?.toLowerCase().includes('closed');
          const isOverdue = !isComplete && task.due_date && task.due_date < now;
          if (isComplete) workload[name].completed++;
          else if (isOverdue) workload[name].overdue++;
          else workload[name].inProgress++;
        }
      }

      const sorted = Object.entries(workload)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 10)
        .map(([name, stats]) => ({ name, ...stats }));
      setData(sorted);
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function usePriorityBreakdownData(workspaceId: string | null) {
  const [data, setData] = useState<{ list: string; urgent: number; high: number; normal: number; low: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: lists } = await supabase
        .from('cached_lists')
        .select('clickup_id, name')
        .eq('workspace_id', workspaceId);
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('list_id, priority')
        .eq('workspace_id', workspaceId);

      if (!lists || !tasks || tasks.length === 0) { setData([]); setLoading(false); return; }

      // ClickUp priorities: 1=urgent, 2=high, 3=normal, 4=low
      const items = lists.map((list) => {
        const listTasks = tasks.filter((t) => t.list_id === list.clickup_id);
        return {
          list: list.name,
          urgent: listTasks.filter((t) => t.priority === 1).length,
          high: listTasks.filter((t) => t.priority === 2).length,
          normal: listTasks.filter((t) => t.priority === 3).length,
          low: listTasks.filter((t) => t.priority === 4).length,
        };
      }).filter((item) => item.urgent + item.high + item.normal + item.low > 0);
      setData(items.slice(0, 10));
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useRecentActivityData(workspaceId: string | null) {
  const [data, setData] = useState<{ id: string; type: string; user: string; action: string; target: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('clickup_id, name, status, assignees, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
        .limit(15) as { data: CachedTask[] | null };

      if (!tasks || tasks.length === 0) { setData([]); setLoading(false); return; }

      const now = Date.now();
      const activities = tasks.map((t) => {
        const assignees = Array.isArray(t.assignees) ? t.assignees : [];
        const userName = assignees.length > 0 && typeof assignees[0] === 'object' && assignees[0]?.username
          ? assignees[0].username
          : 'Someone';
        const isComplete = t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('closed');
        const diffMs = now - new Date(t.updated_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const time = diffMins < 1 ? 'just now' : diffMins < 60 ? `${diffMins}m ago` : diffHours < 24 ? `${diffHours}h ago` : `${diffDays}d ago`;

        return {
          id: t.clickup_id,
          type: isComplete ? 'completed' : 'updated',
          user: userName,
          action: isComplete ? 'completed' : 'updated',
          target: t.name,
          time,
        };
      });
      setData(activities);
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useBarChartData(workspaceId: string | null) {
  const [data, setData] = useState<{ name: string; completed: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('status, assignees')
        .eq('workspace_id', workspaceId) as { data: CachedTask[] | null };
      const { data: members } = await supabase
        .from('cached_team_members')
        .select('clickup_id, username')
        .eq('workspace_id', workspaceId);

      if (!tasks || tasks.length === 0) { setData([]); setLoading(false); return; }

      const memberMap = new Map((members ?? []).map((m) => [m.clickup_id, m.username]));
      const counts: Record<string, number> = {};

      for (const t of tasks) {
        const isComplete = t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('closed');
        if (!isComplete) continue;
        const assignees = Array.isArray(t.assignees) ? t.assignees : [];
        for (const a of assignees) {
          const id = typeof a === 'object' && a !== null ? a.id : String(a);
          if (!id) continue;
          const name = memberMap.get(String(id)) ?? String(id);
          counts[name] = (counts[name] ?? 0) + 1;
        }
      }

      const colors = ['#854DF9', '#9D6FFA', '#854DF9', '#9D6FFA', '#854DF9'];
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, completed], i) => ({ name, completed, color: colors[i % colors.length] }));
      setData(sorted);
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

export function useLineChartData(workspaceId: string | null) {
  const [data, setData] = useState<{ week: string; completed: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('status, updated_at')
        .eq('workspace_id', workspaceId)
        .gte('updated_at', eightWeeksAgo);

      if (!tasks || tasks.length === 0) { setData([]); setLoading(false); return; }

      const weekBuckets: Record<string, number> = {};
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weekBuckets[label] = 0;
      }

      const weekLabels = Object.keys(weekBuckets);
      for (const t of tasks) {
        const isComplete = t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('closed');
        if (!isComplete) continue;
        const updatedDate = new Date(t.updated_at);
        const weeksAgo = Math.floor((now.getTime() - updatedDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const idx = weekLabels.length - 1 - weeksAgo;
        if (idx >= 0 && idx < weekLabels.length) {
          weekBuckets[weekLabels[idx]]++;
        }
      }

      setData(weekLabels.map((week) => ({ week, completed: weekBuckets[week] })));
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
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

export function useOverdueTasksData(workspaceId: string | null) {
  const [data, setData] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    (async () => {
      const now = new Date().toISOString();
      const { data: tasks } = await supabase
        .from('cached_tasks')
        .select('clickup_id, name, status, priority, assignees, due_date, list_id')
        .eq('workspace_id', workspaceId)
        .lt('due_date', now)
        .order('due_date', { ascending: true }) as { data: (CachedTask & { list_id: string })[] | null };

      const { data: lists } = await supabase
        .from('cached_lists')
        .select('clickup_id, name')
        .eq('workspace_id', workspaceId);

      if (!tasks || tasks.length === 0) { setData([]); setLoading(false); return; }

      const listMap = new Map((lists ?? []).map((l) => [l.clickup_id, l.name]));
      const priorityMap: Record<number, OverdueTask['priority']> = { 1: 'urgent', 2: 'high', 3: 'normal', 4: 'low' };

      const overdue = tasks
        .filter((t) => {
          const s = t.status?.toLowerCase() ?? '';
          return !s.includes('complete') && !s.includes('closed');
        })
        .map((t) => {
          const assignees = Array.isArray(t.assignees) ? t.assignees : [];
          const assignee = assignees.length > 0 && typeof assignees[0] === 'object' && assignees[0]?.username
            ? assignees[0].username
            : 'Unassigned';
          const daysOverdue = Math.ceil((Date.now() - new Date(t.due_date!).getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: t.clickup_id,
            name: t.name,
            assignee,
            dueDate: t.due_date!.slice(0, 10),
            priority: priorityMap[t.priority ?? 3] ?? 'normal',
            list: listMap.get(t.list_id) ?? 'Unknown',
            daysOverdue,
          };
        })
        .slice(0, 20);
      setData(overdue);
      setLoading(false);
    })();
  }, [workspaceId]);

  return { data, loading };
}

// ---------------------------------------------------------------------------
// Hook — dashboard management with persistence
// ---------------------------------------------------------------------------

export interface DashboardState {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  widgets: DashboardWidget[];
  isLoading: boolean;
  isSaving: boolean;
  setActiveDashboard: (id: string) => void;
  createDashboard: (name: string, description?: string) => Promise<Dashboard | null>;
  deleteDashboard: (id: string) => Promise<void>;
  renameDashboard: (id: string, name: string, description?: string) => Promise<void>;
  duplicateDashboard: (id: string) => Promise<Dashboard | null>;
  saveLayout: () => Promise<void>;
  addWidget: (config: Partial<DashboardWidget>) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, config: Partial<DashboardWidget>) => void;
  refreshDashboards: () => Promise<void>;
}

/** Persist last-active dashboard choice for a user+workspace in Supabase */
async function persistLastActive(userId: string, workspaceId: string, dashboardId: string) {
  await supabase
    .from('user_dashboard_preferences')
    .upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        last_active_dashboard_id: dashboardId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,workspace_id' }
    );
}

/** Load the last-active dashboard id for a user+workspace */
async function loadLastActive(userId: string, workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_dashboard_preferences')
    .select('last_active_dashboard_id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();
  return data?.last_active_dashboard_id ?? null;
}

export function useDashboard(): DashboardState {
  const { workspace_id } = useWorkspace();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Track whether initial load has resolved the last-active dashboard
  const initialLoadDone = useRef(false);

  // -----------------------------------------------------------------------
  // Fetch dashboards on mount and resolve which one to activate
  // -----------------------------------------------------------------------
  const fetchDashboards = useCallback(async () => {
    if (!workspace_id) { setIsLoading(false); return; }

    const { data: dbDashboards } = await supabase
      .from('dashboards')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: true });

    let dashList = (dbDashboards ?? []) as Dashboard[];

    // Create a default dashboard if none exist
    if (dashList.length === 0 && userId) {
      const { data: newDash } = await supabase
        .from('dashboards')
        .insert({
          workspace_id,
          name: 'Project Overview',
          description: 'Key project metrics and team performance',
          layout: [],
          layout_json: {},
          is_default: true,
          created_by: userId,
        })
        .select()
        .single();
      if (newDash) dashList = [newDash as Dashboard];
    }

    setDashboards(dashList);

    // Determine which dashboard to activate
    let activeId: string | null = null;

    // 1. Try to load the user's last-active preference
    if (userId) {
      activeId = await loadLastActive(userId, workspace_id);
      // Verify the saved preference still exists
      if (activeId && !dashList.find((d) => d.id === activeId)) {
        activeId = null;
      }
    }

    // 2. Fall back to the default dashboard
    if (!activeId) {
      activeId = dashList.find((d) => d.is_default)?.id ?? dashList[0]?.id ?? null;
    }

    setActiveDashboardId(activeId);
    initialLoadDone.current = true;

    // Fetch widgets for the active dashboard
    if (activeId) {
      const { data: dbWidgets } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('workspace_id', workspace_id)
        .eq('dashboard_id', activeId);
      setWidgets(dbWidgets ?? []);
    }

    setIsLoading(false);
  }, [workspace_id, userId]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  // -----------------------------------------------------------------------
  // Reload widgets when active dashboard changes (after initial load)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!workspace_id || !activeDashboardId || !initialLoadDone.current) return;
    (async () => {
      const { data: dbWidgets } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('workspace_id', workspace_id)
        .eq('dashboard_id', activeDashboardId);
      setWidgets(dbWidgets ?? []);
    })();
  }, [workspace_id, activeDashboardId]);

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId) ?? null;

  // -----------------------------------------------------------------------
  // Switch active dashboard — persists the preference
  // -----------------------------------------------------------------------
  const setActiveDashboard = useCallback((id: string) => {
    setActiveDashboardId(id);
    if (userId && workspace_id) {
      persistLastActive(userId, workspace_id, id);
    }
  }, [userId, workspace_id]);

  // -----------------------------------------------------------------------
  // Create a new dashboard
  // -----------------------------------------------------------------------
  const createDashboard = useCallback(async (name: string, description?: string): Promise<Dashboard | null> => {
    if (!workspace_id || !userId) return null;
    const { data: newDash } = await supabase
      .from('dashboards')
      .insert({
        workspace_id,
        name,
        description: description ?? null,
        layout: [],
        layout_json: {},
        is_default: false,
        created_by: userId,
      })
      .select()
      .single();
    if (newDash) {
      const dash = newDash as Dashboard;
      setDashboards((prev) => [...prev, dash]);
      setActiveDashboardId(dash.id);
      if (userId) persistLastActive(userId, workspace_id, dash.id);
      return dash;
    }
    return null;
  }, [workspace_id, userId]);

  // -----------------------------------------------------------------------
  // Delete a dashboard (falls back to next available)
  // -----------------------------------------------------------------------
  const deleteDashboard = useCallback(async (id: string) => {
    await supabase.from('dashboards').delete().eq('id', id);
    setDashboards((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      // If we deleted the active dashboard, switch to next available
      if (activeDashboardId === id) {
        const nextId = remaining.find((d) => d.is_default)?.id ?? remaining[0]?.id ?? null;
        setActiveDashboardId(nextId);
        if (userId && workspace_id && nextId) {
          persistLastActive(userId, workspace_id, nextId);
        }
      }
      return remaining;
    });
    setWidgets((prev) => prev.filter((w) => w.dashboard_id !== id));
  }, [activeDashboardId, userId, workspace_id]);

  // -----------------------------------------------------------------------
  // Rename / update a dashboard's metadata
  // -----------------------------------------------------------------------
  const renameDashboard = useCallback(async (id: string, name: string, description?: string) => {
    const updates: Record<string, unknown> = { name };
    if (description !== undefined) updates.description = description;

    const { data: updated } = await supabase
      .from('dashboards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (updated) {
      setDashboards((prev) => prev.map((d) => (d.id === id ? (updated as Dashboard) : d)));
    }
  }, []);

  // -----------------------------------------------------------------------
  // Duplicate a dashboard (copies widgets too)
  // -----------------------------------------------------------------------
  const duplicateDashboard = useCallback(async (id: string): Promise<Dashboard | null> => {
    if (!workspace_id) return null;

    const source = dashboards.find((d) => d.id === id);
    if (!source) return null;

    // Create the new dashboard
    if (!userId) return null;
    const { data: newDash } = await supabase
      .from('dashboards')
      .insert({
        workspace_id,
        name: `${source.name} (Copy)`,
        description: source.description,
        layout: source.layout,
        layout_json: source.layout_json ?? {},
        is_default: false,
        created_by: userId,
      })
      .select()
      .single();

    if (!newDash) return null;
    const dash = newDash as Dashboard;

    // Copy all widgets from source dashboard
    const { data: sourceWidgets } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('dashboard_id', id)
      .eq('workspace_id', workspace_id);

    if (sourceWidgets && sourceWidgets.length > 0) {
      const widgetInserts = sourceWidgets.map((w: DashboardWidget) => ({
        workspace_id,
        dashboard_id: dash.id,
        type: w.type,
        title: w.title,
        config: w.config,
        position: w.position,
      }));
      await supabase.from('dashboard_widgets').insert(widgetInserts);
    }

    setDashboards((prev) => [...prev, dash]);
    setActiveDashboardId(dash.id);
    if (userId) persistLastActive(userId, workspace_id, dash.id);
    return dash;
  }, [workspace_id, dashboards, userId]);

  // -----------------------------------------------------------------------
  // Save the current layout snapshot to layout_json
  // -----------------------------------------------------------------------
  const saveLayout = useCallback(async () => {
    if (!activeDashboardId || !workspace_id) return;
    setIsSaving(true);

    // Snapshot current widget layout as layout_json
    const layoutSnapshot = {
      widgets: widgets.map((w) => ({
        id: w.id,
        type: w.type,
        title: w.title,
        config: w.config,
        position: w.position,
      })),
      savedAt: new Date().toISOString(),
    };

    const { data: updated } = await supabase
      .from('dashboards')
      .update({ layout_json: layoutSnapshot })
      .eq('id', activeDashboardId)
      .select()
      .single();

    if (updated) {
      setDashboards((prev) => prev.map((d) => (d.id === activeDashboardId ? (updated as Dashboard) : d)));
    }

    setIsSaving(false);
  }, [activeDashboardId, workspace_id, widgets]);

  // -----------------------------------------------------------------------
  // Widget CRUD
  // -----------------------------------------------------------------------
  const addWidget = useCallback(
    async (config: Partial<DashboardWidget>) => {
      if (!workspace_id || !activeDashboardId) return;
      const { data: newWidget } = await supabase
        .from('dashboard_widgets')
        .insert({
          workspace_id,
          dashboard_id: activeDashboardId,
          type: config.type ?? 'summary',
          title: config.title ?? 'New Widget',
          config: config.config ?? {},
          position: config.position ?? { x: 0, y: 0, w: 1, h: 1 },
        })
        .select()
        .single();
      if (newWidget) {
        setWidgets((prev) => [...prev, newWidget]);
      }
    },
    [workspace_id, activeDashboardId]
  );

  const removeWidget = useCallback(async (id: string) => {
    await supabase.from('dashboard_widgets').delete().eq('id', id);
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWidget = useCallback(async (id: string, config: Partial<DashboardWidget>) => {
    const { data: updated } = await supabase
      .from('dashboard_widgets')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (updated) {
      setWidgets((prev) => prev.map((w) => (w.id === id ? updated : w)));
    }
  }, []);

  // -----------------------------------------------------------------------
  // Public refresh function
  // -----------------------------------------------------------------------
  const refreshDashboards = useCallback(async () => {
    setIsLoading(true);
    await fetchDashboards();
  }, [fetchDashboards]);

  return {
    dashboards,
    activeDashboard,
    widgets,
    isLoading,
    isSaving,
    setActiveDashboard,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    duplicateDashboard,
    saveLayout,
    addWidget,
    removeWidget,
    updateWidget,
    refreshDashboards,
  };
}
