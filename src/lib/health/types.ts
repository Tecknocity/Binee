// Health Scoring Engine types — B-060

export interface HealthScore {
  overall: number; // 0-100
  factors: HealthFactor[];
  computedAt: string; // ISO timestamp
  configSource: 'kb' | 'fallback'; // Track where config came from
}

export interface HealthFactor {
  name: string;
  score: number; // 0-100 for this factor
  weight: number; // 0-1, from KB config
  details: string; // e.g., "12 of 45 tasks overdue (27%)"
  severity: 'healthy' | 'warning' | 'critical';
}

export interface ScoringConfig {
  factors: ScoringFactorConfig[];
}

export interface ScoringFactorConfig {
  name: string;
  weight: number; // 0-1
  threshold?: number; // days threshold (overdue, abandoned, inactive)
}

// ---------------------------------------------------------------------------
// Issue Detection types — B-061
// ---------------------------------------------------------------------------

export interface DetectedIssue {
  rule_name: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affected_items: AffectedItem[];
  recommendation: string;
  configSource: 'kb' | 'fallback';
}

export interface AffectedItem {
  type: 'task' | 'list' | 'member';
  id: string;
  name: string;
}

export interface RuleConfig {
  thresholds: Record<string, number>;
  severityMappings: Record<string, SeverityMapping>;
  recommendationTemplates: Record<string, string>;
}

export interface SeverityMapping {
  critical: number; // threshold percentage or count above which severity is critical
  warning: number;  // threshold above which severity is warning (below critical)
}

export interface DetectionRule {
  name: string;
  check: (data: CachedWorkspaceData, config: RuleConfig) => DetectedIssue | null;
}

export interface CachedWorkspaceData {
  tasks: CachedTask[];
  lists: CachedList[];
  members: CachedMember[];
}

export interface CachedTask {
  clickup_id: string;
  name: string;
  status: string | null;
  assignees: unknown;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  list_id: string | null;
  list_statuses?: string[] | null; // valid statuses for the task's list
}

export interface CachedList {
  clickup_id: string;
  name: string;
  updated_at: string;
  statuses?: unknown; // status definitions for this list
}

export interface CachedMember {
  clickup_id: string;
  name: string;
  updated_at: string;
}
