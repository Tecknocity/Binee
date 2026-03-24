// Health Scoring Engine — B-060
// Computes a 0-100 health score from cached ClickUp data.
// Scoring config is loaded from the health-tracker KB module with hardcoded fallbacks.

import { createClient } from '@supabase/supabase-js';
import { getModule } from '@/lib/ai/knowledge-base';
import type { HealthScore, HealthFactor, ScoringConfig, ScoringFactorConfig } from './types';

// ---------------------------------------------------------------------------
// FALLBACK_DEFAULTS — used only when KB module is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_DEFAULTS: ScoringConfig = {
  factors: [
    { name: 'overdue_tasks', weight: 0.3, threshold: 7 },
    { name: 'unassigned_tasks', weight: 0.2 },
    { name: 'abandoned_lists', weight: 0.15, threshold: 30 },
    { name: 'status_consistency', weight: 0.15 },
    { name: 'team_activity', weight: 0.2, threshold: 3 },
  ],
};

// ---------------------------------------------------------------------------
// KB config parser
// ---------------------------------------------------------------------------

/**
 * Parse the health-tracker KB module's markdown content to extract scoring config.
 *
 * Expected KB format (flexible markdown):
 *   ## Health Scoring Rules
 *   - overdue_tasks: weight=0.30, threshold=7
 *   - unassigned_tasks: weight=0.20
 *   - abandoned_lists: weight=0.15, threshold=30
 *   - status_consistency: weight=0.15
 *   - team_activity: weight=0.20, threshold=3
 */
export function parseHealthScoringConfig(content: string): ScoringConfig | null {
  const factors: ScoringFactorConfig[] = [];

  // Match lines like: - factor_name: weight=0.30, threshold=7
  // or: | factor_name | 0.30 | 7 |
  const listPattern = /[-*]\s*([\w_]+)\s*:\s*weight\s*=\s*([\d.]+)(?:\s*,\s*threshold\s*=\s*([\d.]+))?/gi;
  const tablePattern = /\|\s*([\w_]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]*)\s*\|/g;

  let match: RegExpExecArray | null;

  // Try list format first
  while ((match = listPattern.exec(content)) !== null) {
    factors.push({
      name: match[1].toLowerCase(),
      weight: parseFloat(match[2]),
      threshold: match[3] ? parseFloat(match[3]) : undefined,
    });
  }

  // Try table format if no list matches found
  if (factors.length === 0) {
    while ((match = tablePattern.exec(content)) !== null) {
      // Skip header rows
      if (match[1].toLowerCase() === 'factor' || match[1].includes('-')) continue;
      factors.push({
        name: match[1].toLowerCase(),
        weight: parseFloat(match[2]),
        threshold: match[3] ? parseFloat(match[3]) : undefined,
      });
    }
  }

  if (factors.length === 0) return null;

  // Normalize weights to sum to 1.0
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.01) {
    for (const f of factors) {
      f.weight = f.weight / totalWeight;
    }
  }

  return { factors };
}

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Factor scoring functions
// ---------------------------------------------------------------------------

function getFactorConfig(config: ScoringConfig, name: string): ScoringFactorConfig | undefined {
  return config.factors.find((f) => f.name === name);
}

function computeSeverity(score: number): HealthFactor['severity'] {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

interface TaskRow {
  status: string | null;
  assignees: unknown;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ListRow {
  updated_at: string;
}

function scoreOverdueTasks(
  tasks: TaskRow[],
  config: ScoringConfig,
  now: Date,
): HealthFactor | null {
  const fc = getFactorConfig(config, 'overdue_tasks');
  if (!fc) return null;

  const thresholdMs = (fc.threshold ?? 7) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - thresholdMs).toISOString();

  const activeTasks = tasks.filter(
    (t) => t.status && !t.status.toLowerCase().includes('closed') && !t.status.toLowerCase().includes('complete'),
  );
  const overdue = activeTasks.filter((t) => t.due_date && t.due_date < cutoff);
  const pct = activeTasks.length > 0 ? overdue.length / activeTasks.length : 0;

  // Linear scoring: 0% overdue → 100, 50%+ overdue → 0
  const score = Math.round(Math.max(0, Math.min(100, 100 - pct * 200)));

  return {
    name: 'overdue_tasks',
    score,
    weight: fc.weight,
    details: `${overdue.length} of ${activeTasks.length} tasks overdue (${(pct * 100).toFixed(0)}%)`,
    severity: computeSeverity(score),
  };
}

function scoreUnassignedTasks(
  tasks: TaskRow[],
  config: ScoringConfig,
): HealthFactor | null {
  const fc = getFactorConfig(config, 'unassigned_tasks');
  if (!fc) return null;

  const activeTasks = tasks.filter(
    (t) => t.status && !t.status.toLowerCase().includes('closed') && !t.status.toLowerCase().includes('complete'),
  );
  const unassigned = activeTasks.filter(
    (t) => !t.assignees || (Array.isArray(t.assignees) && t.assignees.length === 0),
  );
  const pct = activeTasks.length > 0 ? unassigned.length / activeTasks.length : 0;

  const score = Math.round(Math.max(0, Math.min(100, 100 - pct * 200)));

  return {
    name: 'unassigned_tasks',
    score,
    weight: fc.weight,
    details: `${unassigned.length} of ${activeTasks.length} tasks unassigned (${(pct * 100).toFixed(0)}%)`,
    severity: computeSeverity(score),
  };
}

function scoreAbandonedLists(
  lists: ListRow[],
  config: ScoringConfig,
  now: Date,
): HealthFactor | null {
  const fc = getFactorConfig(config, 'abandoned_lists');
  if (!fc) return null;

  const thresholdMs = (fc.threshold ?? 30) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - thresholdMs).toISOString();

  const abandoned = lists.filter((l) => l.updated_at < cutoff);
  const pct = lists.length > 0 ? abandoned.length / lists.length : 0;

  const score = Math.round(Math.max(0, Math.min(100, 100 - pct * 200)));

  return {
    name: 'abandoned_lists',
    score,
    weight: fc.weight,
    details: `${abandoned.length} of ${lists.length} lists with no activity in ${fc.threshold ?? 30} days (${(pct * 100).toFixed(0)}%)`,
    severity: computeSeverity(score),
  };
}

function scoreStatusConsistency(
  tasks: TaskRow[],
  config: ScoringConfig,
): HealthFactor | null {
  const fc = getFactorConfig(config, 'status_consistency');
  if (!fc) return null;

  const activeTasks = tasks.filter(
    (t) => t.status && !t.status.toLowerCase().includes('closed') && !t.status.toLowerCase().includes('complete'),
  );

  // Tasks with due dates set are considered "well-maintained"
  const withDueDate = activeTasks.filter((t) => t.due_date);
  const pct = activeTasks.length > 0 ? withDueDate.length / activeTasks.length : 0;

  const score = Math.round(Math.max(0, Math.min(100, pct * 100)));

  return {
    name: 'status_consistency',
    score,
    weight: fc.weight,
    details: `${withDueDate.length} of ${activeTasks.length} tasks have due dates (${(pct * 100).toFixed(0)}%)`,
    severity: computeSeverity(score),
  };
}

function scoreTeamActivity(
  tasks: TaskRow[],
  totalMembers: number,
  config: ScoringConfig,
  now: Date,
): HealthFactor | null {
  const fc = getFactorConfig(config, 'team_activity');
  if (!fc) return null;

  const thresholdMs = (fc.threshold ?? 3) * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - thresholdMs).toISOString();

  // Count members who have task activity within the threshold
  const activeMemberIds = new Set<string>();
  for (const task of tasks) {
    if (task.updated_at >= cutoff && task.assignees && Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        const id = typeof assignee === 'object' && assignee !== null
          ? (assignee as { id?: string }).id
          : String(assignee);
        if (id) activeMemberIds.add(String(id));
      }
    }
  }

  const activeCount = Math.min(activeMemberIds.size, totalMembers);
  const pct = totalMembers > 0 ? activeCount / totalMembers : 0;

  const score = Math.round(Math.max(0, Math.min(100, pct * 100)));

  return {
    name: 'team_activity',
    score,
    weight: fc.weight,
    details: `${activeCount} of ${totalMembers} members active in last ${fc.threshold ?? 3} days (${(pct * 100).toFixed(0)}%)`,
    severity: computeSeverity(score),
  };
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export async function computeHealthScore(workspaceId: string): Promise<HealthScore> {
  // Step 1 — Load scoring config from KB
  let config: ScoringConfig;
  let configSource: HealthScore['configSource'] = 'kb';

  try {
    const healthModule = await getModule('health-tracker');
    const parsed = healthModule ? parseHealthScoringConfig(healthModule.content) : null;

    if (parsed) {
      config = parsed;
    } else {
      console.warn('[health-scorer] KB module "health-tracker" not found or unparseable, using FALLBACK_DEFAULTS');
      config = FALLBACK_DEFAULTS;
      configSource = 'fallback';
    }
  } catch (err) {
    console.warn('[health-scorer] Failed to load KB config, using FALLBACK_DEFAULTS:', err);
    config = FALLBACK_DEFAULTS;
    configSource = 'fallback';
  }

  // Step 2 — Query cached data
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return {
      overall: 0,
      factors: config.factors.map((f) => ({
        name: f.name,
        score: 0,
        weight: f.weight,
        details: 'Supabase not configured',
        severity: 'critical' as const,
      })),
      computedAt: new Date().toISOString(),
      configSource,
    };
  }

  const now = new Date();

  const [tasksResult, listsResult, membersResult] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select('status, assignees, due_date, created_at, updated_at')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_lists')
      .select('updated_at')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('clickup_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
  ]);

  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const lists = (listsResult.data ?? []) as ListRow[];
  const totalMembers = membersResult.count ?? 0;

  // Step 3 — Compute weighted score per factor
  const factors: HealthFactor[] = [];

  const overdue = scoreOverdueTasks(tasks, config, now);
  if (overdue) factors.push(overdue);

  const unassigned = scoreUnassignedTasks(tasks, config);
  if (unassigned) factors.push(unassigned);

  const abandoned = scoreAbandonedLists(lists, config, now);
  if (abandoned) factors.push(abandoned);

  const consistency = scoreStatusConsistency(tasks, config);
  if (consistency) factors.push(consistency);

  const activity = scoreTeamActivity(tasks, totalMembers, config, now);
  if (activity) factors.push(activity);

  // Weighted overall score
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const overall = totalWeight > 0
    ? Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight)
    : 0;

  return {
    overall,
    factors,
    computedAt: new Date().toISOString(),
    configSource,
  };
}
