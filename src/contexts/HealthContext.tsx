'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { HealthCheckResult } from '@/types/database';
import type { WorkspaceMetrics } from '@/lib/health/metrics';

// Lazy-initialized to avoid SSR/prerender crashes (env vars missing at build time).
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

export interface WeeklySnapshot {
  week: string;
  date: string;
  score: number;
}

export interface ScoreDelta {
  current: number;
  previous: number | null;
  change: number;
  direction: 'up' | 'down' | 'flat';
}

export interface HealthContextValue {
  healthResult: HealthCheckResult | null;
  metrics: WorkspaceMetrics | null;
  historicalScores: { date: string; score: number }[];
  weeklySnapshots: WeeklySnapshot[];
  scoreDelta: ScoreDelta | null;
  isLoading: boolean;
  error: string | null;
  lastCheckAt: string | null;
  /** True if data has been loaded at least once */
  hasLoaded: boolean;
  runCheck: (workspaceId: string) => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: ReactNode }) {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [historicalScores, setHistoricalScores] = useState<{ date: string; score: number }[]>([]);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const [scoreDelta, setScoreDelta] = useState<ScoreDelta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const runningRef = useRef(false);

  const runCheck = useCallback(async (workspaceId: string) => {
    if (!workspaceId || runningRef.current) return;
    runningRef.current = true;
    setIsLoading(true);
    setError(null);

    // Timeout protection: if the health check hangs for 30s, abort and
    // release the lock so subsequent attempts aren't permanently blocked.
    const timeoutId = setTimeout(() => {
      setError('Health check timed out. Please try again.');
      setHasLoaded(true);
      setIsLoading(false);
      runningRef.current = false;
    }, 30_000);

    try {
      // Run API call and historical data fetches in parallel
      const supabase = getSupabase();
      const [apiRes, historyRes, snapshotsRes] = await Promise.all([
        fetch('/api/health/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId }),
        }),
        supabase
          .from('health_check_results')
          .select('overall_score, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true })
          .limit(30),
        supabase
          .from('health_snapshots')
          .select('overall_score, previous_score, snapshot_week')
          .eq('workspace_id', workspaceId)
          .order('snapshot_week', { ascending: true })
          .limit(12),
      ]);

      // Process API result
      if (apiRes.ok) {
        const data = await apiRes.json();
        setHealthResult(data.result ?? null);
        setMetrics(data.metrics ?? null);
      } else {
        setError('Failed to run health check');
      }

      // Process historical scores
      const history = historyRes.data;
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

      // Process weekly snapshots
      const snapshots = snapshotsRes.data;
      if (snapshots && snapshots.length > 0) {
        const formatted: WeeklySnapshot[] = snapshots.map((s) => {
          const d = new Date(s.snapshot_week);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return { week: label, date: s.snapshot_week, score: s.overall_score };
        });
        setWeeklySnapshots(formatted);

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

      setLastCheckAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      clearTimeout(timeoutId);
      // Mark as loaded even on failure — prevents permanent "Running health
      // check..." spinner when the API errors out or times out.
      setHasLoaded(true);
      setIsLoading(false);
      runningRef.current = false;
    }
  }, []);

  return (
    <HealthContext.Provider
      value={{
        healthResult,
        metrics,
        historicalScores,
        weeklySnapshots,
        scoreDelta,
        isLoading,
        error,
        lastCheckAt,
        hasLoaded,
        runCheck,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useHealthContext(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealthContext must be used within HealthProvider');
  return ctx;
}
