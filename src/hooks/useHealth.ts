'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { HealthCheckResult } from '@/types/database';
import type { WorkspaceMetrics } from '@/lib/health/metrics';

const supabase = createBrowserClient();

export interface HealthState {
  healthResult: HealthCheckResult | null;
  metrics: WorkspaceMetrics | null;
  historicalScores: { date: string; score: number }[];
  isLoading: boolean;
  error: string | null;
  lastCheckAt: string | null;
  runCheck: () => Promise<void>;
}

export function useHealth(workspaceId?: string): HealthState {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ date: string; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch health check via API (server-side computation)
      const res = await fetch('/api/health/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (res.ok) {
        const data = await res.json();
        setHealthResult(data.result ?? null);
        setMetrics(data.metrics ?? null);
      } else {
        setError('Failed to run health check');
      }

      // Fetch historical scores from health_check_results table
      const { data: history } = await supabase
        .from('health_check_results')
        .select('overall_score, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .limit(30);

      if (history && history.length > 0) {
        setHistoricalScores(
          history.map((h) => ({
            date: new Date(h.created_at).toISOString().slice(0, 10),
            score: h.overall_score ?? 0,
          }))
        );
      } else {
        setHistoricalScores([]);
      }

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
