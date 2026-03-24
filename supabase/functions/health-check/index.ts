// supabase/functions/health-check/index.ts
// B-062: Scheduled Edge Function that runs health scoring periodically.
// For each active workspace: computes health score + detects issues,
// inserts result into health_check_results for trend tracking.
// Designed to run via cron (daily or every 6 hours).
// One workspace failure does not block others.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceMetrics {
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  tasksDueToday: number;
  tasksDueThisWeek: number;
  abandonedLists: number;
  totalMembers: number;
  activeMembers7d: number;
}

interface HealthIssue {
  id: string;
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affected_items: string[];
  suggestion: string;
}

interface HealthCheckResult {
  workspace_id: string;
  overall_score: number;
  category_scores: Record<string, number>;
  issues: HealthIssue[];
  recommendations: string[];
  previous_score: number | null;
  credits_used: number;
}

// ---------------------------------------------------------------------------
// Metrics computation (mirrors src/lib/health/metrics.ts)
// ---------------------------------------------------------------------------

async function computeWorkspaceMetrics(
  workspaceId: string
): Promise<WorkspaceMetrics> {
  const supabase = getSupabase();
  const now = new Date();
  const nowISO = now.toISOString();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const weekEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 7
  ).toISOString();

  // Fetch all tasks
  const { data: allTasks } = await supabase
    .from("cached_tasks")
    .select("clickup_id, status, assignees, due_date, created_at, updated_at")
    .eq("workspace_id", workspaceId);

  const tasks = allTasks ?? [];
  const totalTasks = tasks.length;

  const openStatuses = tasks.filter(
    (t: { status: string }) =>
      t.status &&
      !t.status.toLowerCase().includes("closed") &&
      !t.status.toLowerCase().includes("complete")
  );
  const activeTasks = openStatuses.length;

  const overdueTasks = openStatuses.filter(
    (t: { due_date: string | null }) => t.due_date && t.due_date < nowISO
  ).length;

  const unassignedTasks = openStatuses.filter(
    (t: { assignees: unknown }) =>
      !t.assignees ||
      (Array.isArray(t.assignees) && t.assignees.length === 0)
  ).length;

  const tasksDueToday = openStatuses.filter(
    (t: { due_date: string | null }) =>
      t.due_date &&
      t.due_date >= todayStart &&
      t.due_date <
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        ).toISOString()
  ).length;

  const tasksDueThisWeek = openStatuses.filter(
    (t: { due_date: string | null }) =>
      t.due_date && t.due_date >= todayStart && t.due_date < weekEnd
  ).length;

  // Fetch members
  const { count: memberCount } = await supabase
    .from("cached_team_members")
    .select("clickup_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const totalMembers = memberCount ?? 0;

  // Active members: those with tasks updated in last 7 days
  const activeMemberIds = new Set<string>();
  for (const task of tasks) {
    if (
      task.updated_at >= sevenDaysAgo &&
      task.assignees &&
      Array.isArray(task.assignees)
    ) {
      for (const assignee of task.assignees) {
        const id =
          typeof assignee === "object" && assignee !== null
            ? (assignee as { id?: string }).id
            : String(assignee);
        if (id) activeMemberIds.add(String(id));
      }
    }
  }
  const activeMembers7d = Math.min(activeMemberIds.size, totalMembers);

  // Lists — check for abandoned
  const { data: lists } = await supabase
    .from("cached_lists")
    .select("clickup_id, updated_at")
    .eq("workspace_id", workspaceId);

  const allLists = lists ?? [];
  const abandonedLists = allLists.filter(
    (l: { updated_at: string }) => l.updated_at < thirtyDaysAgo
  ).length;

  return {
    totalTasks,
    activeTasks,
    overdueTasks,
    unassignedTasks,
    tasksDueToday,
    tasksDueThisWeek,
    abandonedLists,
    totalMembers,
    activeMembers7d,
  };
}

// ---------------------------------------------------------------------------
// Scoring functions (mirrors src/lib/health/checker.ts)
// ---------------------------------------------------------------------------

function computeOverdueScore(metrics: WorkspaceMetrics): {
  score: number;
  issues: HealthIssue[];
} {
  const issues: HealthIssue[] = [];
  const pct =
    metrics.totalTasks > 0 ? metrics.overdueTasks / metrics.totalTasks : 0;

  let score: number;
  if (pct === 0) score = 25;
  else if (pct <= 0.1) score = 20;
  else if (pct <= 0.25) score = 10;
  else score = 0;

  if (score < 25) {
    const severity: HealthIssue["severity"] =
      pct > 0.25 ? "critical" : pct > 0.1 ? "warning" : "info";
    issues.push({
      id: "overdue-tasks",
      category: "overdue_tasks",
      severity,
      title: `${metrics.overdueTasks} overdue tasks`,
      description: `${(pct * 100).toFixed(0)}% of your tasks are past their due date, affecting team throughput and client expectations.`,
      affected_items: [],
      suggestion:
        "Review overdue tasks and either update due dates, reassign, or close stale items.",
    });
  }

  return { score, issues };
}

function computeUnassignedScore(metrics: WorkspaceMetrics): {
  score: number;
  issues: HealthIssue[];
} {
  const issues: HealthIssue[] = [];
  const pct =
    metrics.totalTasks > 0 ? metrics.unassignedTasks / metrics.totalTasks : 0;

  let score: number;
  if (pct === 0) score = 20;
  else if (pct <= 0.05) score = 15;
  else if (pct <= 0.15) score = 10;
  else score = 0;

  if (score < 20) {
    const severity: HealthIssue["severity"] =
      pct > 0.15 ? "warning" : "info";
    issues.push({
      id: "unassigned-tasks",
      category: "unassigned_tasks",
      severity,
      title: `${metrics.unassignedTasks} unassigned tasks`,
      description: `${(pct * 100).toFixed(1)}% of tasks have no assignee, meaning no one is accountable for their completion.`,
      affected_items: [],
      suggestion:
        "Assign owners to all active tasks to ensure accountability and balanced workload.",
    });
  }

  return { score, issues };
}

function computeListActivityScore(metrics: WorkspaceMetrics): {
  score: number;
  issues: HealthIssue[];
} {
  const issues: HealthIssue[] = [];
  const score = Math.max(0, 20 - metrics.abandonedLists * 4);

  if (metrics.abandonedLists > 0) {
    issues.push({
      id: "abandoned-lists",
      category: "abandoned_lists",
      severity: metrics.abandonedLists >= 4 ? "warning" : "info",
      title: `${metrics.abandonedLists} abandoned lists detected`,
      description:
        "These lists have had no task activity in the past 30 days and may be cluttering your workspace.",
      affected_items: [],
      suggestion:
        "Archive or delete unused lists to keep the workspace organized and navigation clean.",
    });
  }

  return { score, issues };
}

function computeTeamActivityScore(metrics: WorkspaceMetrics): {
  score: number;
  issues: HealthIssue[];
} {
  const issues: HealthIssue[] = [];
  const inactiveMembers = metrics.totalMembers - metrics.activeMembers7d;
  const score = Math.max(0, 20 - inactiveMembers * 5);

  if (inactiveMembers > 0) {
    issues.push({
      id: "inactive-members",
      category: "inactive_members",
      severity:
        inactiveMembers >= 4
          ? "critical"
          : inactiveMembers >= 2
            ? "warning"
            : "info",
      title: `${inactiveMembers} inactive team members`,
      description:
        "These members have not logged any activity in the past 7 days, which may indicate disengagement or tool adoption issues.",
      affected_items: [],
      suggestion:
        "Check in with inactive members and ensure they are onboarded properly to ClickUp.",
    });
  }

  return { score, issues };
}

function computeTaskHygieneScore(metrics: WorkspaceMetrics): {
  score: number;
  issues: HealthIssue[];
} {
  const issues: HealthIssue[] = [];
  const tasksWithDueDates =
    metrics.tasksDueThisWeek + metrics.overdueTasks + metrics.tasksDueToday;
  const pct =
    metrics.activeTasks > 0
      ? Math.min(tasksWithDueDates / metrics.activeTasks, 1)
      : 0;

  let score: number;
  if (pct > 0.8) score = 15;
  else if (pct > 0.5) score = 10;
  else if (pct > 0.3) score = 5;
  else score = 0;

  if (score < 15) {
    issues.push({
      id: "task-hygiene",
      category: "status_inconsistency",
      severity: pct < 0.3 ? "warning" : "info",
      title: "Incomplete task metadata",
      description: `Only ${(pct * 100).toFixed(0)}% of tasks have due dates set. Missing dates make it difficult to plan and track progress.`,
      affected_items: [],
      suggestion:
        "Set due dates on all active tasks and establish a team convention for task metadata.",
    });
  }

  return { score, issues };
}

// ---------------------------------------------------------------------------
// Run health check for a single workspace
// ---------------------------------------------------------------------------

async function runHealthCheck(
  workspaceId: string,
  previousScore: number | null
): Promise<HealthCheckResult> {
  const metrics = await computeWorkspaceMetrics(workspaceId);

  const overdue = computeOverdueScore(metrics);
  const unassigned = computeUnassignedScore(metrics);
  const listActivity = computeListActivityScore(metrics);
  const teamActivity = computeTeamActivityScore(metrics);
  const taskHygiene = computeTaskHygieneScore(metrics);

  const overallScore =
    overdue.score +
    unassigned.score +
    listActivity.score +
    teamActivity.score +
    taskHygiene.score;

  const allIssues = [
    ...overdue.issues,
    ...unassigned.issues,
    ...listActivity.issues,
    ...teamActivity.issues,
    ...taskHygiene.issues,
  ];

  return {
    workspace_id: workspaceId,
    overall_score: overallScore,
    category_scores: {
      overdue_tasks: overdue.score,
      unassigned_tasks: unassigned.score,
      list_activity: listActivity.score,
      team_activity: teamActivity.score,
      task_hygiene: taskHygiene.score,
    },
    issues: allIssues,
    recommendations: allIssues.map((i) => i.suggestion),
    previous_score: previousScore,
    credits_used: 0, // Cron health checks are free
  };
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Accept both GET (cron) and POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabase();

    // If POST with workspace_id, run for that workspace only
    let targetWorkspaceIds: string[] | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.workspace_id) {
          targetWorkspaceIds = [body.workspace_id];
        }
      } catch {
        // No body or invalid JSON — run for all workspaces
      }
    }

    // Get workspaces to process
    let workspaces: { id: string }[];
    if (targetWorkspaceIds) {
      const { data } = await supabase
        .from("workspaces")
        .select("id")
        .in("id", targetWorkspaceIds)
        .eq("clickup_connected", true);
      workspaces = data ?? [];
    } else {
      // Cron mode: all connected workspaces
      const { data } = await supabase
        .from("workspaces")
        .select("id")
        .eq("clickup_connected", true);
      workspaces = data ?? [];
    }

    if (workspaces.length === 0) {
      return new Response(
        JSON.stringify({ message: "No connected workspaces", checked: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let checked = 0;
    const errors: string[] = [];

    for (const ws of workspaces) {
      try {
        // Get previous score for trend tracking
        const { data: lastCheck } = await supabase
          .from("health_check_results")
          .select("overall_score")
          .eq("workspace_id", ws.id)
          .order("checked_at", { ascending: false })
          .limit(1)
          .single();

        const result = await runHealthCheck(
          ws.id,
          lastCheck?.overall_score ?? null
        );

        // Insert into health_check_results
        const { error: insertError } = await supabase
          .from("health_check_results")
          .insert({
            workspace_id: result.workspace_id,
            overall_score: result.overall_score,
            category_scores: result.category_scores,
            issues: result.issues,
            recommendations: result.recommendations,
            previous_score: result.previous_score,
            credits_used: 0,
          });

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        checked++;
        console.log(
          `[health-check] Workspace ${ws.id}: score=${result.overall_score}, issues=${result.issues.length}`
        );
      } catch (err) {
        const msg = `${ws.id}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        console.error(`[health-check] Error for workspace ${ws.id}:`, err);
        // Continue to next workspace — one failure should not block others
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        total: workspaces.length,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[health-check] Fatal error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
