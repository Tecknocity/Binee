// Issue Detection Rules — B-061
// Pure-function rules that check cached ClickUp data for workspace issues.
// Rule definitions, thresholds, and recommendations are loaded from KB modules.

import type {
  DetectionRule,
  DetectedIssue,
  CachedWorkspaceData,
  RuleConfig,
  AffectedItem,
} from './types';

// ---------------------------------------------------------------------------
// Fallback defaults — used only when KB modules are unavailable
// ---------------------------------------------------------------------------

export const FALLBACK_RULE_CONFIG: RuleConfig = {
  thresholds: {
    overdue_critical_days: 7,
    inactive_list_days: 30,
    inactive_member_days: 3,
  },
  severityMappings: {
    overdue_tasks: { critical: 0.25, warning: 0.1 },
    unassigned_tasks: { critical: 0.2, warning: 0.05 },
    abandoned_lists: { critical: 5, warning: 2 },
    inactive_members: { critical: 4, warning: 2 },
    status_inconsistency: { critical: 0.3, warning: 0.1 },
  },
  recommendationTemplates: {
    overdue_tasks:
      'Review overdue tasks and either update due dates, reassign, or close stale items.',
    unassigned_tasks:
      'Assign owners to all active tasks to ensure accountability and balanced workload.',
    abandoned_lists:
      'Archive or delete unused lists to keep the workspace organized.',
    inactive_members:
      'Check in with inactive members and ensure they are properly onboarded to ClickUp.',
    status_inconsistency:
      'Review tasks with invalid statuses and update them to match list-defined workflows.',
  },
};

// ---------------------------------------------------------------------------
// KB content parser
// ---------------------------------------------------------------------------

/**
 * Parse issue detection rules from health-tracker and analyzer-auditor KB module content.
 *
 * The health-tracker module provides threshold values and severity definitions.
 * The analyzer-auditor module provides audit patterns and recommendation templates.
 */
export function parseIssueDetectionRules(
  healthContent: string,
  auditorContent: string,
): RuleConfig | null {
  const thresholds: Record<string, number> = {};
  const severityMappings: Record<string, { critical: number; warning: number }> = {};
  const recommendationTemplates: Record<string, string> = {};

  const combined = `${healthContent}\n${auditorContent}`;
  let foundAny = false;

  // Parse thresholds: "- threshold_name: 7" or "| threshold_name | 7 |"
  const thresholdPattern =
    /[-*]\s*([\w_]+)\s*:\s*([\d.]+)\s*(?:days?)?/gi;
  let match: RegExpExecArray | null;

  // Look for a thresholds section
  const thresholdSection = extractSection(combined, 'threshold');
  if (thresholdSection) {
    while ((match = thresholdPattern.exec(thresholdSection)) !== null) {
      thresholds[match[1].toLowerCase()] = parseFloat(match[2]);
      foundAny = true;
    }
  }

  // Parse severity mappings: "- rule_name: critical=0.25, warning=0.1"
  const severityPattern =
    /[-*]\s*([\w_]+)\s*:\s*critical\s*=\s*([\d.]+)\s*,\s*warning\s*=\s*([\d.]+)/gi;
  const severitySection = extractSection(combined, 'severity');
  if (severitySection) {
    while ((match = severityPattern.exec(severitySection)) !== null) {
      severityMappings[match[1].toLowerCase()] = {
        critical: parseFloat(match[2]),
        warning: parseFloat(match[3]),
      };
      foundAny = true;
    }
  }

  // Parse recommendation templates: "- rule_name: \"recommendation text\""
  // or: "**rule_name**: recommendation text"
  const recPatternQuoted =
    /[-*]\s*([\w_]+)\s*:\s*["'](.+?)["']/gi;
  const recPatternBold =
    /\*\*([\w_]+)\*\*\s*:\s*(.+)/gi;
  const recSection = extractSection(combined, 'recommendation');
  if (recSection) {
    while ((match = recPatternQuoted.exec(recSection)) !== null) {
      recommendationTemplates[match[1].toLowerCase()] = match[2].trim();
      foundAny = true;
    }
    while ((match = recPatternBold.exec(recSection)) !== null) {
      if (!recommendationTemplates[match[1].toLowerCase()]) {
        recommendationTemplates[match[1].toLowerCase()] = match[2].trim();
        foundAny = true;
      }
    }
  }

  // Also try general list-style patterns for recommendations anywhere
  const recGeneralPattern =
    /[-*]\s*([\w_]+)_recommendation\s*:\s*(.+)/gi;
  while ((match = recGeneralPattern.exec(combined)) !== null) {
    const key = match[1].toLowerCase();
    if (!recommendationTemplates[key]) {
      recommendationTemplates[key] = match[2].trim();
      foundAny = true;
    }
  }

  if (!foundAny) return null;

  return { thresholds, severityMappings, recommendationTemplates };
}

/**
 * Extract content under a section header containing the given keyword.
 * Looks for ## headings and returns content until the next ## heading.
 */
function extractSection(content: string, keyword: string): string | null {
  const pattern = new RegExp(
    `^#{1,3}\\s+[^\\n]*${keyword}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`,
    'im',
  );
  const match = pattern.exec(content);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Helper: determine severity from a ratio/count and severity mapping
// ---------------------------------------------------------------------------

function determineSeverity(
  value: number,
  ruleName: string,
  config: RuleConfig,
): 'critical' | 'warning' | 'info' {
  const mapping = config.severityMappings[ruleName];
  if (!mapping) return value > 0 ? 'warning' : 'info';
  if (value >= mapping.critical) return 'critical';
  if (value >= mapping.warning) return 'warning';
  return 'info';
}

function getRecommendation(ruleName: string, config: RuleConfig): string {
  return (
    config.recommendationTemplates[ruleName] ??
    FALLBACK_RULE_CONFIG.recommendationTemplates[ruleName] ??
    `Review and address ${ruleName.replace(/_/g, ' ')} issues.`
  );
}

function getThreshold(key: string, config: RuleConfig, fallback: number): number {
  return config.thresholds[key] ?? FALLBACK_RULE_CONFIG.thresholds[key] ?? fallback;
}

function isActiveTask(t: { status: string | null }): boolean {
  if (!t.status) return false;
  const s = t.status.toLowerCase();
  return !s.includes('closed') && !s.includes('complete');
}

// ---------------------------------------------------------------------------
// Detection rules — each is a pure function
// ---------------------------------------------------------------------------

const overdueTasksRule: DetectionRule = {
  name: 'overdue_tasks',
  check(data: CachedWorkspaceData, config: RuleConfig): DetectedIssue | null {
    const now = new Date();
    const criticalDays = getThreshold('overdue_critical_days', config, 7);
    const criticalCutoff = new Date(
      now.getTime() - criticalDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const active = data.tasks.filter(isActiveTask);
    const overdue = active.filter(
      (t) => t.due_date && t.due_date < criticalCutoff,
    );

    if (overdue.length === 0) return null;

    const ratio = active.length > 0 ? overdue.length / active.length : 0;
    const severity = determineSeverity(ratio, 'overdue_tasks', config);

    const affected: AffectedItem[] = overdue.slice(0, 20).map((t) => ({
      type: 'task' as const,
      id: t.clickup_id,
      name: t.name,
    }));

    return {
      rule_name: 'overdue_tasks',
      severity,
      description: `${overdue.length} tasks are overdue by more than ${criticalDays} days (${(ratio * 100).toFixed(0)}% of active tasks).`,
      affected_items: affected,
      recommendation: getRecommendation('overdue_tasks', config),
      configSource: 'kb',
    };
  },
};

const unassignedTasksRule: DetectionRule = {
  name: 'unassigned_tasks',
  check(data: CachedWorkspaceData, config: RuleConfig): DetectedIssue | null {
    const active = data.tasks.filter(isActiveTask);
    const unassigned = active.filter(
      (t) =>
        !t.assignees ||
        (Array.isArray(t.assignees) && t.assignees.length === 0),
    );

    if (unassigned.length === 0) return null;

    const ratio = active.length > 0 ? unassigned.length / active.length : 0;
    const severity = determineSeverity(ratio, 'unassigned_tasks', config);

    const affected: AffectedItem[] = unassigned.slice(0, 20).map((t) => ({
      type: 'task' as const,
      id: t.clickup_id,
      name: t.name,
    }));

    return {
      rule_name: 'unassigned_tasks',
      severity,
      description: `${unassigned.length} active tasks have no assignee (${(ratio * 100).toFixed(0)}% of active tasks).`,
      affected_items: affected,
      recommendation: getRecommendation('unassigned_tasks', config),
      configSource: 'kb',
    };
  },
};

const abandonedListsRule: DetectionRule = {
  name: 'abandoned_lists',
  check(data: CachedWorkspaceData, config: RuleConfig): DetectedIssue | null {
    const inactiveDays = getThreshold('inactive_list_days', config, 30);
    const cutoff = new Date(
      Date.now() - inactiveDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const abandoned = data.lists.filter((l) => l.updated_at < cutoff);

    if (abandoned.length === 0) return null;

    const severity = determineSeverity(abandoned.length, 'abandoned_lists', config);

    const affected: AffectedItem[] = abandoned.slice(0, 20).map((l) => ({
      type: 'list' as const,
      id: l.clickup_id,
      name: l.name,
    }));

    return {
      rule_name: 'abandoned_lists',
      severity,
      description: `${abandoned.length} lists have had no activity in the past ${inactiveDays} days.`,
      affected_items: affected,
      recommendation: getRecommendation('abandoned_lists', config),
      configSource: 'kb',
    };
  },
};

const inactiveMembersRule: DetectionRule = {
  name: 'inactive_members',
  check(data: CachedWorkspaceData, config: RuleConfig): DetectedIssue | null {
    const inactiveDays = getThreshold('inactive_member_days', config, 3);
    const cutoff = new Date(
      Date.now() - inactiveDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Members with no task updates within threshold
    const activeMemberIds = new Set<string>();
    for (const task of data.tasks) {
      if (task.updated_at >= cutoff && task.assignees && Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          const id =
            typeof assignee === 'object' && assignee !== null
              ? (assignee as { id?: string }).id
              : String(assignee);
          if (id) activeMemberIds.add(String(id));
        }
      }
    }

    const inactive = data.members.filter(
      (m) => !activeMemberIds.has(m.clickup_id),
    );

    if (inactive.length === 0) return null;

    const severity = determineSeverity(inactive.length, 'inactive_members', config);

    const affected: AffectedItem[] = inactive.slice(0, 20).map((m) => ({
      type: 'member' as const,
      id: m.clickup_id,
      name: m.name,
    }));

    return {
      rule_name: 'inactive_members',
      severity,
      description: `${inactive.length} team members have had no activity in the past ${inactiveDays} days.`,
      affected_items: affected,
      recommendation: getRecommendation('inactive_members', config),
      configSource: 'kb',
    };
  },
};

const statusInconsistencyRule: DetectionRule = {
  name: 'status_inconsistency',
  check(data: CachedWorkspaceData, config: RuleConfig): DetectedIssue | null {
    // Build a map of list_id → valid status names from list statuses
    const listStatusMap = new Map<string, Set<string>>();
    for (const list of data.lists) {
      if (list.statuses && Array.isArray(list.statuses)) {
        const validStatuses = new Set<string>();
        for (const s of list.statuses) {
          const statusName =
            typeof s === 'object' && s !== null
              ? (s as { status?: string }).status
              : String(s);
          if (statusName) validStatuses.add(statusName.toLowerCase());
        }
        if (validStatuses.size > 0) {
          listStatusMap.set(list.clickup_id, validStatuses);
        }
      }
    }

    // If no lists have status definitions, we can't detect inconsistencies
    if (listStatusMap.size === 0) return null;

    const active = data.tasks.filter(isActiveTask);
    const inconsistent = active.filter((t) => {
      if (!t.list_id || !t.status) return false;
      const validStatuses = listStatusMap.get(t.list_id);
      if (!validStatuses) return false;
      return !validStatuses.has(t.status.toLowerCase());
    });

    if (inconsistent.length === 0) return null;

    const ratio = active.length > 0 ? inconsistent.length / active.length : 0;
    const severity = determineSeverity(ratio, 'status_inconsistency', config);

    const affected: AffectedItem[] = inconsistent.slice(0, 20).map((t) => ({
      type: 'task' as const,
      id: t.clickup_id,
      name: t.name,
    }));

    return {
      rule_name: 'status_inconsistency',
      severity,
      description: `${inconsistent.length} tasks have statuses not defined in their list workflows (${(ratio * 100).toFixed(0)}% of active tasks).`,
      affected_items: affected,
      recommendation: getRecommendation('status_inconsistency', config),
      configSource: 'kb',
    };
  },
};

// ---------------------------------------------------------------------------
// Built-in rules registry
// ---------------------------------------------------------------------------

export const BUILT_IN_RULES: DetectionRule[] = [
  overdueTasksRule,
  unassignedTasksRule,
  abandonedListsRule,
  inactiveMembersRule,
  statusInconsistencyRule,
];
