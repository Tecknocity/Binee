'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  FolderOpen,
  Folder,
  List,
  CheckSquare,
  Users,
  RefreshCw,
} from 'lucide-react';
import type { FullSyncProgress } from '@/lib/clickup/sync';

interface SyncProgressProps {
  workspaceId: string;
  onComplete?: () => void;
  /** When 'onboarding', shows friendly rotating messages and estimated time */
  variant?: 'default' | 'onboarding';
}

const SYNC_PHASES = ['spaces', 'folders', 'lists', 'tasks', 'members'] as const;

const PHASE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  spaces: { label: 'Spaces', icon: <FolderOpen className="w-4 h-4" /> },
  folders: { label: 'Folders', icon: <Folder className="w-4 h-4" /> },
  lists: { label: 'Lists', icon: <List className="w-4 h-4" /> },
  tasks: { label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  members: { label: 'Members', icon: <Users className="w-4 h-4" /> },
};

const ONBOARDING_MESSAGES = [
  'Getting to know your workspace...',
  'Mapping out your projects...',
  'Learning your team structure...',
  'Discovering your workflows...',
  'Cataloging your tasks...',
  'Almost there...',
];

/** Estimate remaining sync time based on total items and elapsed time */
function estimateTimeRemaining(progress: FullSyncProgress): string | null {
  if (!progress.startedAt || progress.total === 0 || progress.current === 0) return null;
  const elapsed = Date.now() - new Date(progress.startedAt).getTime();
  const rate = progress.current / elapsed; // items per ms
  const remaining = (progress.total - progress.current) / rate;
  if (remaining < 5_000) return 'a few seconds';
  if (remaining < 60_000) return `about ${Math.ceil(remaining / 1_000)} seconds`;
  if (remaining < 120_000) return 'about a minute';
  return `about ${Math.ceil(remaining / 60_000)} minutes`;
}

/** Estimate total time for large workspaces before sync data is available */
function estimateBySize(counts: FullSyncProgress['counts']): string | null {
  const total = counts.spaces + counts.folders + counts.lists + counts.tasks + counts.members;
  if (total === 0) return null;
  if (total > 5_000) return 'This is a large workspace — sync may take a few minutes.';
  if (total > 1_000) return 'This may take about a minute for a workspace this size.';
  return null;
}

export function SyncProgress({ workspaceId, onComplete, variant = 'default' }: SyncProgressProps) {
  const [progress, setProgress] = useState<FullSyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageIdx, setMessageIdx] = useState(0);
  const completeCalled = useRef(false);
  const isOnboarding = variant === 'onboarding';

  // Rotate onboarding messages every 4 seconds
  useEffect(() => {
    if (!isOnboarding) return;
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % ONBOARDING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOnboarding]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/clickup/sync/progress?workspace_id=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to fetch progress' }));
        setError(data.error ?? 'Failed to fetch progress');
        return;
      }
      const data: FullSyncProgress = await res.json();
      setProgress(data);
      setError(null);
    } catch {
      setError('Network error — retrying...');
    }
  }, [workspaceId]);

  // Poll every 2 seconds while syncing
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchProgress is an async data fetch that sets state on completion
    fetchProgress();
    const interval = setInterval(fetchProgress, 2000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  // Fire onComplete once when sync finishes
  useEffect(() => {
    if (progress && (progress.status === 'idle' || progress.status === 'complete') && progress.counts.spaces > 0 && !completeCalled.current) {
      completeCalled.current = true;
      onComplete?.();
    }
  }, [progress, onComplete]);

  const isComplete = progress?.status === 'idle' || progress?.status === 'complete';
  const isSyncing = progress?.status === 'syncing';
  const isError = progress?.status === 'error';
  const currentPhase = progress?.phase ?? '';

  // Calculate overall percentage from current/total
  const percentage = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : isComplete && progress?.counts.spaces ? 100 : 0;

  // Determine phase status
  const getPhaseStatus = (phase: string): 'done' | 'current' | 'pending' => {
    if (isComplete) return 'done';
    if (!isSyncing) return 'pending';

    const currentIdx = SYNC_PHASES.indexOf(currentPhase as typeof SYNC_PHASES[number]);
    const phaseIdx = SYNC_PHASES.indexOf(phase as typeof SYNC_PHASES[number]);

    if (currentIdx === -1) return 'pending';
    if (phaseIdx < currentIdx) return 'done';
    if (phaseIdx === currentIdx) return 'current';
    return 'pending';
  };

  const getCount = (phase: string): number => {
    if (!progress) return 0;
    return progress.counts[phase as keyof typeof progress.counts] ?? 0;
  };

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6">
      {/* Header */}
      <div className="py-6 text-center">
        {isComplete ? (
          <>
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Data Synced!</h2>
            <p className="text-sm text-text-secondary mt-1">
              Your ClickUp workspace has been imported successfully.
            </p>
          </>
        ) : isError ? (
          <>
            <div className="w-14 h-14 rounded-full bg-error/15 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-7 h-7 text-error" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Sync Error</h2>
            <p className="text-sm text-error mt-1">
              {progress?.error ?? 'Something went wrong during sync.'}
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-7 h-7 text-accent animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">
              {isOnboarding ? ONBOARDING_MESSAGES[messageIdx] : 'Syncing your workspace...'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {progress?.message ?? (isOnboarding ? 'Importing your ClickUp data so Binee can help you.' : 'Pulling data from ClickUp...')}
            </p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-muted">Progress</span>
          <span className="text-xs font-medium text-text-secondary">{percentage}%</span>
        </div>
        <div className="h-2 bg-surface border border-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isComplete ? 'bg-success' : isError ? 'bg-error' : 'bg-accent'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Phase indicators */}
      <div className="flex items-center justify-between mb-4 px-2">
        {SYNC_PHASES.map((phase) => {
          const status = getPhaseStatus(phase);
          const config = PHASE_CONFIG[phase];

          return (
            <div
              key={phase}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                status === 'done' ? 'text-success' : status === 'current' ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {status === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : status === 'current' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {SYNC_PHASES.map((phase) => {
          const status = getPhaseStatus(phase);
          const config = PHASE_CONFIG[phase];
          const count = getCount(phase);

          return (
            <div
              key={phase}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                status === 'done'
                  ? 'bg-success/5 border-success/20'
                  : status === 'current'
                  ? 'bg-accent/5 border-accent/20'
                  : 'bg-surface border-border'
              }`}
            >
              <div
                className={`${
                  status === 'done'
                    ? 'text-success'
                    : status === 'current'
                    ? 'text-accent'
                    : 'text-text-muted'
                }`}
              >
                {config.icon}
              </div>
              <span
                className={`text-lg font-semibold font-mono tabular-nums ${
                  status === 'done'
                    ? 'text-success'
                    : status === 'current'
                    ? 'text-accent'
                    : 'text-text-muted'
                }`}
              >
                {count}
              </span>
              <span className="text-[10px] text-text-muted">{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Estimated time (onboarding variant) */}
      {isOnboarding && isSyncing && progress && (() => {
        const timeLeft = estimateTimeRemaining(progress);
        const sizeNote = estimateBySize(progress.counts);
        const display = timeLeft ? `Estimated time remaining: ${timeLeft}` : sizeNote;
        if (!display) return null;
        return (
          <div className="mb-4 text-center">
            <p className="text-xs text-text-muted">{display}</p>
          </div>
        );
      })()}

      {/* Error details */}
      {error && (
        <div className="mt-3 bg-error/10 border border-error/20 rounded-xl p-3">
          <div className="flex items-start gap-2 text-sm text-error/80">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
