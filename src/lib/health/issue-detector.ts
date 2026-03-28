// Issue Detector — B-061
// Runs rule-based checks against cached ClickUp data to detect workspace issues.
// Rule config (thresholds, severity, recommendations) is loaded from KB modules
// with hardcoded fallbacks when KB is unavailable.

import { createClient } from '@supabase/supabase-js';
import {
  BUILT_IN_RULES,
  FALLBACK_RULE_CONFIG,
} from './rules';
import type {
  DetectedIssue,
  RuleConfig,
  CachedWorkspaceData,
  CachedTask,
  CachedList,
  CachedMember,
} from './types';

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
// Load rule config from KB modules
// ---------------------------------------------------------------------------

async function loadRuleConfig(): Promise<{
  config: RuleConfig;
  source: 'kb' | 'fallback';
}> {
  // KB system removed in architecture migration — always use fallback defaults
  return { config: FALLBACK_RULE_CONFIG, source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Load cached workspace data from Supabase
// ---------------------------------------------------------------------------

async function loadCachedData(
  workspaceId: string,
): Promise<CachedWorkspaceData | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const [tasksResult, listsResult, membersResult] = await Promise.all([
    supabase
      .from('cached_tasks')
      .select(
        'clickup_id, name, status, assignees, due_date, created_at, updated_at, list_id',
      )
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_lists')
      .select('clickup_id, name, updated_at, statuses')
      .eq('workspace_id', workspaceId),
    supabase
      .from('cached_team_members')
      .select('clickup_id, name, updated_at')
      .eq('workspace_id', workspaceId),
  ]);

  return {
    tasks: (tasksResult.data ?? []) as CachedTask[],
    lists: (listsResult.data ?? []) as CachedList[],
    members: (membersResult.data ?? []) as CachedMember[],
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Detect workspace health issues by running rule-based checks against cached data.
 * Rules and thresholds are loaded from the health-tracker and analyzer-auditor
 * KB modules, with hardcoded fallback defaults.
 */
export async function detectIssues(
  workspaceId: string,
): Promise<DetectedIssue[]> {
  // Step 1 — Load rule config from KB
  const { config, source } = await loadRuleConfig();

  // Step 2 — Load cached workspace data
  const data = await loadCachedData(workspaceId);
  if (!data) {
    console.warn('[issue-detector] Supabase not configured, returning empty issues');
    return [];
  }

  // Step 3 — Run each rule against the data
  const issues: DetectedIssue[] = [];

  for (const rule of BUILT_IN_RULES) {
    try {
      const issue = rule.check(data, config);
      if (issue) {
        // Tag the config source
        issue.configSource = source;
        issues.push(issue);
      }
    } catch (err) {
      console.error(
        `[issue-detector] Rule "${rule.name}" threw an error:`,
        err,
      );
    }
  }

  // Sort by severity: critical first, then warning, then info
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  issues.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  );

  return issues;
}
