import { createClient } from '@supabase/supabase-js';
import type { BineeContext } from '@/types/ai';

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
// Build full context for the AI
// ---------------------------------------------------------------------------

export async function buildContext(
  workspaceId: string,
  userId: string,
  conversationId: string,
): Promise<BineeContext> {
  const supabase = getSupabaseAdmin();

  const [
    workspaceResult,
    memberResult,
    workspaceSummary,
    recentActivity,
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
    buildWorkspaceSummary(workspaceId),
    buildRecentActivity(workspaceId),
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

  return {
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
    workspaceSummary,
    recentActivity,
    conversationHistory,
  };
}

// ---------------------------------------------------------------------------
// Workspace summary from cached data
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
// Recent activity from webhook events (last 24h)
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

  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error || !messages) {
    return [];
  }

  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }));
}
