// Health check engine — computes workspace health scores from cached data

import type { HealthCheckResult, HealthIssue } from '@/types/database';
import { computeWorkspaceMetrics, type WorkspaceMetrics } from './metrics';

function computeOverdueScore(metrics: WorkspaceMetrics): { score: number; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const pct = metrics.totalTasks > 0 ? metrics.overdueTasks / metrics.totalTasks : 0;

  let score: number;
  if (pct === 0) score = 25;
  else if (pct <= 0.1) score = 20;
  else if (pct <= 0.25) score = 10;
  else score = 0;

  if (score < 25) {
    const severity: HealthIssue['severity'] = pct > 0.25 ? 'critical' : pct > 0.1 ? 'warning' : 'info';
    issues.push({
      id: 'overdue-tasks',
      category: 'overdue_tasks',
      severity,
      title: `${metrics.overdueTasks} overdue tasks`,
      description: `${(pct * 100).toFixed(0)}% of your tasks are past their due date, affecting team throughput and client expectations.`,
      affected_items: [],
      suggestion: 'Review overdue tasks and either update due dates, reassign, or close stale items.',
    });
  }

  return { score, issues };
}

function computeUnassignedScore(metrics: WorkspaceMetrics): { score: number; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const pct = metrics.totalTasks > 0 ? metrics.unassignedTasks / metrics.totalTasks : 0;

  let score: number;
  if (pct === 0) score = 20;
  else if (pct <= 0.05) score = 15;
  else if (pct <= 0.15) score = 10;
  else score = 0;

  if (score < 20) {
    const severity: HealthIssue['severity'] = pct > 0.15 ? 'warning' : 'info';
    issues.push({
      id: 'unassigned-tasks',
      category: 'unassigned_tasks',
      severity,
      title: `${metrics.unassignedTasks} unassigned tasks`,
      description: `${(pct * 100).toFixed(1)}% of tasks have no assignee, meaning no one is accountable for their completion.`,
      affected_items: [],
      suggestion: 'Assign owners to all active tasks to ensure accountability and balanced workload.',
    });
  }

  return { score, issues };
}

function computeListActivityScore(metrics: WorkspaceMetrics): { score: number; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const score = Math.max(0, 20 - metrics.abandonedLists * 4);

  if (metrics.abandonedLists > 0) {
    issues.push({
      id: 'abandoned-lists',
      category: 'abandoned_lists',
      severity: metrics.abandonedLists >= 4 ? 'warning' : 'info',
      title: `${metrics.abandonedLists} abandoned lists detected`,
      description: `These lists have had no task activity in the past 30 days and may be cluttering your workspace.`,
      affected_items: [],
      suggestion: 'Archive or delete unused lists to keep the workspace organized and navigation clean.',
    });
  }

  return { score, issues };
}

function computeTeamActivityScore(metrics: WorkspaceMetrics): { score: number; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const inactiveMembers = metrics.totalMembers - metrics.activeMembers7d;
  const score = Math.max(0, 20 - inactiveMembers * 5);

  if (inactiveMembers > 0) {
    issues.push({
      id: 'inactive-members',
      category: 'inactive_members',
      severity: inactiveMembers >= 4 ? 'critical' : inactiveMembers >= 2 ? 'warning' : 'info',
      title: `${inactiveMembers} inactive team members`,
      description: `These members have not logged any activity in the past 7 days, which may indicate disengagement or tool adoption issues.`,
      affected_items: [],
      suggestion: 'Check in with inactive members and ensure they are onboarded properly to ClickUp.',
    });
  }

  return { score, issues };
}

function computeTaskHygieneScore(metrics: WorkspaceMetrics): { score: number; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  // Tasks with due dates: active tasks minus those due (overdue + due this week gives a baseline)
  // For a proper count, we check activeTasks that have due_date vs those without
  const tasksWithDueDates = metrics.tasksDueThisWeek + metrics.overdueTasks + metrics.tasksDueToday;
  const pct = metrics.activeTasks > 0 ? Math.min(tasksWithDueDates / metrics.activeTasks, 1) : 0;

  let score: number;
  if (pct > 0.8) score = 15;
  else if (pct > 0.5) score = 10;
  else if (pct > 0.3) score = 5;
  else score = 0;

  if (score < 15) {
    issues.push({
      id: 'task-hygiene',
      category: 'status_inconsistency',
      severity: pct < 0.3 ? 'warning' : 'info',
      title: 'Incomplete task metadata',
      description: `Only ${(pct * 100).toFixed(0)}% of tasks have due dates set. Missing dates make it difficult to plan and track progress.`,
      affected_items: [],
      suggestion: 'Set due dates on all active tasks and establish a team convention for task metadata.',
    });
  }

  return { score, issues };
}

export async function runHealthCheck(workspaceId: string, previousScore?: number): Promise<HealthCheckResult> {
  const metrics = await computeWorkspaceMetrics(workspaceId);

  const overdue = computeOverdueScore(metrics);
  const unassigned = computeUnassignedScore(metrics);
  const listActivity = computeListActivityScore(metrics);
  const teamActivity = computeTeamActivityScore(metrics);
  const taskHygiene = computeTaskHygieneScore(metrics);

  const overallScore =
    overdue.score + unassigned.score + listActivity.score + teamActivity.score + taskHygiene.score;

  const allIssues = [
    ...overdue.issues,
    ...unassigned.issues,
    ...listActivity.issues,
    ...teamActivity.issues,
    ...taskHygiene.issues,
  ];

  return {
    id: crypto.randomUUID(),
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
    checked_at: new Date().toISOString(),
    credits_used: 1,
    previous_score: null,
    created_at: new Date().toISOString(),
  };
}
