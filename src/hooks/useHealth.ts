'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { HealthCheckResult } from '@/types/database';
import type { WorkspaceMetrics } from '@/lib/health/metrics';

const supabase = createBrowserClient();

export interface WeeklySnapshot {
  week: string; // e.g. "Mar 10"
  date: string; // ISO date string (YYYY-MM-DD)
  score: number;
}

export interface ScoreDelta {
  current: number;
  previous: number | null;
  change: number; // positive = improved, negative = declined
  direction: 'up' | 'down' | 'flat';
}

export interface HealthState {
  healthResult: HealthCheckResult | null;
  metrics: WorkspaceMetrics | null;
  historicalScores: { date: string; score: number }[];
  weeklySnapshots: WeeklySnapshot[];
  scoreDelta: ScoreDelta | null;
  isLoading: boolean;
  error: string | null;
  lastCheckAt: string | null;
  runCheck: () => Promise<void>;
}

export function useHealth(workspaceId?: string): HealthState {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ date: string; score: number }[]>([]);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const [scoreDelta, setScoreDelta] = useState<ScoreDelta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);

  const fetchWeeklySnapshots = useCallback(async (wsId: string) => {
    const { data: snapshots } = await supabase
      .from('health_snapshots')
      .select('overall_score, previous_score, snapshot_week')
      .eq('workspace_id', wsId)
      .order('snapshot_week', { ascending: true })
      .limit(12);

    if (snapshots && snapshots.length > 0) {
      const formatted: WeeklySnapshot[] = snapshots.map((s) => {
        const d = new Date(s.snapshot_week);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
          week: label,
          date: s.snapshot_week,
          score: s.overall_score,
        };
      });
      setWeeklySnapshots(formatted);

      // Compute delta from the two most recent snapshots
      const latest = snapshots[snapshots.length - 1];
      const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
      const currentScore = latest.overall_score;
      const previousScore = prev?.overall_score ?? latest.previous_score ?? null;
      const change = previousScore !== null ? currentScore - previousScore : 0;

      setScoreDelta({
        current: currentScore,
        previous: previousScore,
        change,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      });
    } else {
      setWeeklySnapshots([]);
      setScoreDelta(null);
    }
  }, []);

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

      // Fetch weekly snapshots from health_snapshots table
      await fetchWeeklySnapshots(workspaceId);

      setLastCheckAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, fetchWeeklySnapshots]);

  // Auto-load on mount
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return {
    healthResult,
    metrics,
    historicalScores,
    weeklySnapshots,
    scoreDelta,
    isLoading,
    error,
    lastCheckAt,
    runCheck,
  };
}
