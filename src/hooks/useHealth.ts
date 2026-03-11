'use client';

import { useState, useCallback, useEffect } from 'react';
import type { HealthCheckResult } from '@/types/database';
import type { WorkspaceMetrics } from '@/lib/health/metrics';
import { runHealthCheck } from '@/lib/health/checker';
import { computeWorkspaceMetrics } from '@/lib/health/metrics';

// 30 days of mock historical health scores for trend chart
function generateHistoricalScores(): { date: string; score: number }[] {
  const scores: { date: string; score: number }[] = [];
  const now = new Date();
  // Start around 65, trend upward to ~73 with some variance
  let score = 65;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    score = Math.min(100, Math.max(40, score + (Math.random() * 6 - 2.5)));
    scores.push({
      date: d.toISOString().slice(0, 10),
      score: Math.round(score),
    });
  }
  // Ensure the last one matches our target of ~73
  scores[scores.length - 1].score = 73;
  return scores;
}

export interface HealthState {
  healthResult: HealthCheckResult | null;
  metrics: WorkspaceMetrics | null;
  historicalScores: { date: string; score: number }[];
  isLoading: boolean;
  error: string | null;
  lastCheckAt: string | null;
  runCheck: () => Promise<void>;
}

export function useHealth(workspaceId: string = 'mock-workspace'): HealthState {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [historicalScores] = useState(() => generateHistoricalScores());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [result, m] = await Promise.all([
        runHealthCheck(workspaceId),
        computeWorkspaceMetrics(workspaceId),
      ]);
      setHealthResult(result);
      setMetrics(m);
      setLastCheckAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Auto-load on mount
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return {
    healthResult,
    metrics,
    historicalScores,
    isLoading,
    error,
    lastCheckAt,
    runCheck,
  };
}
