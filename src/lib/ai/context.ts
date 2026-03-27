import { createClient } from '@supabase/supabase-js';
import type { BineeContext, BusinessState, TaskType } from '@/types/ai';
import { computeHealthScore } from '@/lib/health/scorer';
import { detectIssues } from '@/lib/health/issue-detector';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate token budget for the BusinessState document */
const TOKEN_BUDGET = 3000;

/** Rough chars-per-token ratio for structured JSON */
const CHARS_PER_TOKEN = 4;

/** Max assignees shown in the by_assignee breakdown */
const MAX_ASSIGNEES = 15;

/** Max spaces shown in the structure summary */
const MAX_SPACES = 10;

/** Max folders per space in the structure summary */
const MAX_FOLDERS_PER_SPACE = 8;

/** Max folderless lists per space */
const MAX_FOLDERLESS_LISTS = 8;

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
// Empty business state — used for general_chat to skip expensive queries
// ---------------------------------------------------------------------------

function getEmptyBusinessState(workspaceId: string): BusinessState {
  return {
    generated_at: new Date().toISOString(),
    workspace_id: workspaceId,
    tasks: { total: 0, overdue: 0, unassigned: 0, by_status: {}, by_priority: {}, by_assignee: [] },
    team: { total_members: 0, members: [] },
    structure: { total_spaces: 0, total_folders: 0, total_lists: 0, spaces: [] },
    recent_activity: { total_events: 0, by_type: {} },
    _meta: { approx_tokens: 0, truncated: false },
  };
}

// ---------------------------------------------------------------------------
// Build full context for the AI
// ---------------------------------------------------------------------------

export async function buildContext(
  workspaceId: string,
  userId: string,
  conversationId: string,
  taskType?: TaskType,
): Promise<BineeContext> {
  const supabase = getSupabaseAdmin();

  // For general_chat: skip the expensive business state document.
  // Only fetch workspace + user metadata + conversation history.
  const isLightweight = taskType === 'general_chat';

  // For simple tasks: build a compact business state with just task metrics
  // (counts, overdue, unassigned) — skip the full structure/team/activity
  // queries. This reduces from 6 DB queries to 3 and cuts context by ~60%.
  const COMPACT_TASK_TYPES = new Set(['simple_lookup', 'health_check', 'troubleshooting']);
  const isCompact = taskType ? COMPACT_TASK_TYPES.has(taskType) : false;

  const [
    workspaceResult,
    memberResult,
    businessState,
    conversationHistory,
  ] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, clickup_connected, clickup_plan_tier, credit_balance, last_sync_at')
      .eq('id', workspaceId)
      .single(),
    supabase
      .from('workspace_members')
      .select('user_id, role, email, display_name')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single(),
    isLightweight
      ? Promise.resolve(getEmptyBusinessState(workspaceId))
      : isCompact
        ? buildCompactBusinessState(workspaceId)
        : buildBusinessStateDocument(workspaceId),
    fetchConversationHistory(conversationId),
  ]);

  if (workspaceResult.error || !workspaceResult.data) {
    throw new Error(`Workspace not found: ${workspaceResult.error?.message}`);
  }

  if (memberResult.error || !memberResult.data) {
    throw new Error(`User not found in workspace: ${memberResult.error?.message}`);
  }

  const workspace = workspaceResult.data;
  const member = memberResult.data;

  const result: BineeContext = {
    user: {
      id: userId,
      display_name: member.display_name ?? 'Unknown',
      role: member.role as 'admin' | 'member',
      email: member.email ?? '',
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      clickup_connected: workspace.clickup_connected ?? false,
      clickup_plan_tier: workspace.clickup_plan_tier,
      credit_balance: workspace.credit_balance ?? 0,
      last_sync_at: workspace.last_sync_at,
    },
    businessState,
    workspaceSummary: '',
    recentActivity: '',
    conversationHistory,
  };

  // B-070: When task is a dashboard request, fetch active dashboard with widgets
  if (taskType === 'dashboard_request') {
    try {
      const activeDashboard = await fetchActiveDashboard(workspaceId);
      if (activeDashboard) {
        result.activeDashboard = activeDashboard;
      }
    } catch (err) {
      console.warn('[context] Failed to fetch active dashboard for dashboard_request:', err);
    }
  }

  // B-065: When task is a health check, fetch health score + active issues
  if (taskType === 'health_check') {
    try {
      const [healthScore, issues] = await Promise.all([
        computeHealthScore(workspaceId),
        detectIssues(workspaceId),
      ]);

      result.healthSnapshot = {
        health_score: healthScore.overall,
        health_factors: healthScore.factors.map((f) => ({
          name: f.name,
          score: f.score,
          weight: f.weight,
          details: f.details,
          severity: f.severity,
        })),
        active_issues: issues.slice(0, 10).map((i) => ({
          rule_name: i.rule_name,
          severity: i.severity,
          description: i.description,
          affected_items: i.affected_items.map((a) => ({
            type: a.type,
            id: a.id,
            name: a.name,
          })),
          recommendation: i.recommendation,
        })),
        critical_count: issues.filter((i) => i.severity === 'critical').length,
        warning_count: issues.filter((i) => i.severity === 'warning').length,
      };
    } catch (err) {
      console.warn('[context] Failed to fetch health snapshot for health_check:', err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Business State Document (B-041)
//
// Queries cached_* tables and compresses workspace data into structured JSON.
// Target: 1,500–3,000 tokens. Replaces sending raw data to the LLM.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Compact business state — just task metrics, no structure/team/activity
// Used for simple_lookup, health_check, troubleshooting to cut ~60% tokens.
// Only runs 2 DB queries instead of 6. Target: ~300–500 tokens.
// ---------------------------------------------------------------------------

async function buildCompactBusinessState(
  workspaceId: string,
): Promise<BusinessState> {
  const supabase = getSupabaseAdmin();

  // Only fetch tasks and members — skip spaces, folders, lists, activity
  const [tasksResult, membersResult] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select('id, status, priority, assignees, due_date')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('clickup_id, username')
      .eq('workspace_id', workspaceId),
  ]);

  const tasks = tasksResult.data ?? [];
  const members = membersResult.data ?? [];
  const now = new Date().toISOString();

  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < now && t.status !== 'closed' && t.status !== 'complete',
  );
  const unassignedTasks = tasks.filter(
    (t) => !t.assignees || (Array.isArray(t.assignees) && t.assignees.length === 0),
  );

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const task of tasks) {
    const status = task.status ?? 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    workspace_id: workspaceId,
    tasks: {
      total: tasks.length,
      overdue: overdueTasks.length,
      unassigned: unassignedTasks.length,
      by_status: statusCounts,
      by_priority: {},
      by_assignee: [],
    },
    team: {
      total_members: members.length,
      members: [],
    },
    structure: {
      total_spaces: 0,
      total_folders: 0,
      total_lists: 0,
      spaces: [],
    },
    recent_activity: { total_events: 0, by_type: {} },
    _meta: { approx_tokens: 0, truncated: false },
  };
}

export async function buildBusinessStateDocument(
  workspaceId: string,
): Promise<BusinessState> {
  const supabase = getSupabaseAdmin();

  const [tasksResult, membersResult, spacesResult, foldersResult, listsResult, activityResult] =
    await Promise.all([
      supabase
        .from('cached_tasks')
        .select('id, status, priority, assignees, due_date')
        .eq('workspace_id', workspaceId),
      supabase
        .from('cached_team_members')
        .select('clickup_id, username, email')
        .eq('workspace_id', workspaceId),
      supabase
        .from('cached_spaces')
        .select('clickup_id, name')
        .eq('workspace_id', workspaceId),
      supabase
        .from('cached_folders')
        .select('clickup_id, space_id, name')
        .eq('workspace_id', workspaceId),
      supabase
        .from('cached_lists')
        .select('clickup_id, space_id, folder_id, name')
        .eq('workspace_id', workspaceId),
      fetchRecentActivityCounts(workspaceId),
    ]);

  const tasks = tasksResult.data ?? [];
  const members = membersResult.data ?? [];
  const spaces = spacesResult.data ?? [];
  const folders = foldersResult.data ?? [];
  const lists = listsResult.data ?? [];

  // -- Task metrics --------------------------------------------------------

  const now = new Date().toISOString();

  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date < now &&
      t.status !== 'closed' &&
      t.status !== 'complete',
  );

  const unassignedTasks = tasks.filter(
    (t) => !t.assignees || (Array.isArray(t.assignees) && t.assignees.length === 0),
  );

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const task of tasks) {
    const status = task.status ?? 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  // Priority distribution (1=urgent, 2=high, 3=normal, 4=low, null=none)
  const priorityLabels: Record<number, string> = {
    1: 'urgent',
    2: 'high',
    3: 'normal',
    4: 'low',
  };
  const priorityCounts: Record<string, number> = {};
  for (const task of tasks) {
    const label = task.priority ? (priorityLabels[task.priority as number] ?? 'unknown') : 'none';
    priorityCounts[label] = (priorityCounts[label] || 0) + 1;
  }

  // Assignee distribution — build a clickup_id → username map from members
  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.clickup_id, m.username);
  }

  const assigneeCounts: Record<string, number> = {};
  for (const task of tasks) {
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      for (const assignee of task.assignees) {
        const id = typeof assignee === 'string' ? assignee : (assignee as { id?: string })?.id;
        if (id) {
          const name = memberMap.get(id) ?? `user-${id.slice(-4)}`;
          assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
        }
      }
    }
  }

  const byAssignee = Object.entries(assigneeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_ASSIGNEES)
    .map(([name, count]) => ({ name, count }));

  // -- Team snapshot -------------------------------------------------------

  const teamMembers = members.map((m) => ({
    name: m.username,
    email: m.email ?? null,
  }));

  // -- Workspace structure (spaces → folders → lists) ----------------------

  const foldersBySpace = new Map<string, typeof folders>();
  for (const f of folders) {
    const arr = foldersBySpace.get(f.space_id) ?? [];
    arr.push(f);
    foldersBySpace.set(f.space_id, arr);
  }

  const listsByFolder = new Map<string, typeof lists>();
  const folderlessListsBySpace = new Map<string, typeof lists>();
  for (const l of lists) {
    if (l.folder_id) {
      const arr = listsByFolder.get(l.folder_id) ?? [];
      arr.push(l);
      listsByFolder.set(l.folder_id, arr);
    } else {
      const arr = folderlessListsBySpace.get(l.space_id) ?? [];
      arr.push(l);
      folderlessListsBySpace.set(l.space_id, arr);
    }
  }

  let truncated = false;

  const structureSpaces = spaces.slice(0, MAX_SPACES).map((space) => {
    const spaceFolders = (foldersBySpace.get(space.clickup_id) ?? [])
      .slice(0, MAX_FOLDERS_PER_SPACE)
      .map((f) => ({
        name: f.name,
        list_count: (listsByFolder.get(f.clickup_id) ?? []).length,
      }));

    const folderlessLists = (folderlessListsBySpace.get(space.clickup_id) ?? [])
      .slice(0, MAX_FOLDERLESS_LISTS)
      .map((l) => l.name);

    return {
      name: space.name,
      folders: spaceFolders,
      folderless_lists: folderlessLists,
    };
  });

  if (spaces.length > MAX_SPACES) truncated = true;

  // -- Build the document --------------------------------------------------

  const doc: BusinessState = {
    generated_at: new Date().toISOString(),
    workspace_id: workspaceId,
    tasks: {
      total: tasks.length,
      overdue: overdueTasks.length,
      unassigned: unassignedTasks.length,
      by_status: statusCounts,
      by_priority: priorityCounts,
      by_assignee: byAssignee,
    },
    team: {
      total_members: members.length,
      members: teamMembers,
    },
    structure: {
      total_spaces: spaces.length,
      total_folders: folders.length,
      total_lists: lists.length,
      spaces: structureSpaces,
    },
    recent_activity: activityResult,
    _meta: {
      approx_tokens: 0,
      truncated,
    },
  };

  // Estimate token count and trim if over budget
  const serialized = JSON.stringify(doc);
  doc._meta.approx_tokens = Math.ceil(serialized.length / CHARS_PER_TOKEN);

  if (doc._meta.approx_tokens > TOKEN_BUDGET) {
    return trimToTokenBudget(doc);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Trim strategy — progressively reduce detail to fit token budget
// ---------------------------------------------------------------------------

function trimToTokenBudget(doc: BusinessState): BusinessState {
  const trimmed = { ...doc };

  // Step 1: Trim team member emails
  trimmed.team = {
    ...trimmed.team,
    members: trimmed.team.members.map((m) => ({ name: m.name, email: null })),
  };

  // Step 2: Reduce assignee list to top 10
  trimmed.tasks = {
    ...trimmed.tasks,
    by_assignee: trimmed.tasks.by_assignee.slice(0, 10),
  };

  // Step 3: Trim structure — fewer folders, fewer lists
  trimmed.structure = {
    ...trimmed.structure,
    spaces: trimmed.structure.spaces.slice(0, 6).map((s) => ({
      ...s,
      folders: s.folders.slice(0, 5),
      folderless_lists: s.folderless_lists.slice(0, 5),
    })),
  };

  // Step 4: If still over, drop member names
  let serialized = JSON.stringify(trimmed);
  let approxTokens = Math.ceil(serialized.length / CHARS_PER_TOKEN);

  if (approxTokens > TOKEN_BUDGET) {
    trimmed.team.members = [];
  }

  // Step 5: If still over, drop structure spaces detail
  serialized = JSON.stringify(trimmed);
  approxTokens = Math.ceil(serialized.length / CHARS_PER_TOKEN);

  if (approxTokens > TOKEN_BUDGET) {
    trimmed.structure.spaces = [];
  }

  serialized = JSON.stringify(trimmed);
  trimmed._meta = {
    approx_tokens: Math.ceil(serialized.length / CHARS_PER_TOKEN),
    truncated: true,
  };

  return trimmed;
}

// ---------------------------------------------------------------------------
// Recent activity counts from webhook events (last 24h)
// ---------------------------------------------------------------------------

async function fetchRecentActivityCounts(
  workspaceId: string,
): Promise<{ total_events: number; by_type: Record<string, number> }> {
  const supabase = getSupabaseAdmin();
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('event_type')
    .eq('workspace_id', workspaceId)
    .gte('created_at', twentyFourHoursAgo)
    .limit(100);

  if (error || !events || events.length === 0) {
    return { total_events: 0, by_type: {} };
  }

  const byType: Record<string, number> = {};
  for (const event of events) {
    const type = event.event_type ?? 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  return { total_events: events.length, by_type: byType };
}

// ---------------------------------------------------------------------------
// Workspace summary from cached data (legacy text format)
// ---------------------------------------------------------------------------

export async function buildWorkspaceSummary(
  workspaceId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const [tasksResult, membersResult, listsResult] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select('id, status, assignees, due_date', { count: 'exact' })
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('id', { count: 'exact' })
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_lists')
      .select('id, name', { count: 'exact' })
      .eq('workspace_id', workspaceId),
  ]);

  const totalTasks = tasksResult.count ?? 0;
  const totalMembers = membersResult.count ?? 0;
  const totalLists = listsResult.count ?? 0;

  const now = new Date().toISOString();
  const tasks = tasksResult.data ?? [];
  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date < now &&
      t.status !== 'closed' &&
      t.status !== 'complete',
  );

  // Unassigned: empty or null assignees jsonb array
  const unassignedTasks = tasks.filter(
    (t) => !t.assignees || (Array.isArray(t.assignees) && t.assignees.length === 0),
  );

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const task of tasks) {
    const status = task.status ?? 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const statusLines = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([status, count]) => `  - ${status}: ${count}`)
    .join('\n');

  return `- Total tasks: ${totalTasks}
- Overdue tasks: ${overdueTasks.length}
- Unassigned tasks: ${unassignedTasks.length}
- Team members: ${totalMembers}
- Lists: ${totalLists}
- Status breakdown (top 5):
${statusLines || '  (no data)'}`;
}

// ---------------------------------------------------------------------------
// Recent activity from webhook events (last 24h) — legacy text format
// ---------------------------------------------------------------------------

export async function buildRecentActivity(
  workspaceId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('event_type, payload, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !events || events.length === 0) {
    return 'No recent activity in the last 24 hours.';
  }

  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    const type = event.event_type ?? 'unknown';
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  }

  const lines = Object.entries(eventCounts)
    .map(([type, count]) => `- ${type}: ${count} event(s)`)
    .join('\n');

  return `${events.length} events in the last 24 hours:\n${lines}`;
}

// ---------------------------------------------------------------------------
// Conversation history
// ---------------------------------------------------------------------------

async function fetchConversationHistory(
  conversationId: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const supabase = getSupabaseAdmin();

  // Fetch conversation summary + last 6 messages (instead of last 10).
  // If the conversation has a stored summary, prepend it as context
  // so the model understands earlier discussion without resending full history.
  const [convResult, messagesResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('summary')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const messages = messagesResult.data ?? [];
  // Messages came in reverse order (newest first), flip back
  const chronological = messages.reverse();

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // If there's a stored summary and we have messages, inject it as context
  const summary = convResult.data?.summary;
  if (summary && chronological.length > 0) {
    history.push({
      role: 'user' as const,
      content: `[Previous conversation summary: ${summary}]`,
    });
    history.push({
      role: 'assistant' as const,
      content: 'Understood, I have the context from our earlier discussion.',
    });
  }

  for (const m of chronological) {
    history.push({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    });
  }

  return history;
}

// ---------------------------------------------------------------------------
// B-070: Active dashboard with widget summaries
// ---------------------------------------------------------------------------

async function fetchActiveDashboard(
  workspaceId: string,
): Promise<{
  id: string;
  name: string;
  widgets: Array<{
    id: string;
    title: string;
    type: string;
    summary_config: Record<string, unknown>;
  }>;
} | null> {
  const supabase = getSupabaseAdmin();

  // Find the most recently updated dashboard (or default) for this workspace
  const { data: dashboard } = await supabase
    .from('dashboards')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!dashboard) return null;

  // Fetch all widgets on that dashboard
  const { data: widgets } = await supabase
    .from('dashboard_widgets')
    .select('id, title, type, config')
    .eq('workspace_id', workspaceId)
    .eq('dashboard_id', dashboard.id)
    .order('created_at', { ascending: true });

  return {
    id: dashboard.id,
    name: dashboard.name,
    widgets: (widgets ?? []).map((w) => {
      const config = (w.config as Record<string, unknown>) ?? {};
      return {
        id: w.id,
        title: w.title,
        type: w.type,
        summary_config: {
          data_source: config.data_source ?? 'tasks',
          group_by: config.group_by ?? 'status',
          filters: config.filters ?? {},
          sort_by: config.sort_by ?? null,
        },
      };
    }),
  };
}
