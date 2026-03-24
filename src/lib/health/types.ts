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
