'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertTriangle,
  FolderOpen,
  Folder,
  List,
  Sparkles,
  SkipForward,
  RefreshCw,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { ExecutionProgress as ExecutionProgressType, ExecutionResult, SetupPlan } from '@/lib/setup/types';
import type { ExecutionItem } from '@/lib/setup/executor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemState = 'pending' | 'in-progress' | 'success' | 'error' | 'cascade' | 'skipped';

interface DerivedItem {
  name: string;
  type: 'space' | 'folder' | 'list';
  parentName?: string;
  state: ItemState;
  error?: string;
}

interface ExecutionProgressProps {
  progress: ExecutionProgressType | null;
  result: ExecutionResult | null;
  plan: SetupPlan | null;
  /** Optional B-075 per-item execution data for richer status tracking */
  executionItems?: ExecutionItem[];
  /** Whether execution is currently in-flight (API call pending) */
  isExecuting?: boolean;
  /** Called when user clicks "Retry Failed Items" after a build with errors */
  onRetry?: () => void;
  /** Called when user clicks "Continue Anyway" or "Continue" after build */
  onContinue?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  'creating_spaces',
  'creating_folders',
  'creating_lists',
  'creating_tasks',
  'creating_docs',
] as const;

const PHASE_LABELS: Record<string, string> = {
  creating_spaces: 'Spaces',
  creating_folders: 'Folders',
  creating_lists: 'Lists',
  creating_tasks: 'Tasks',
  creating_docs: 'Docs',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  space: <FolderOpen className="w-3.5 h-3.5" />,
  folder: <Folder className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
};

/** Detect cascade errors (child failed because parent failed, not a real error) */
function isCascadeError(error?: string): boolean {
  if (!error) return false;
  return error.startsWith('Skipped: parent ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExecutionProgress({
  progress,
  result: _result,
  plan,
  executionItems,
  isExecuting,
  onRetry,
  onContinue,
}: ExecutionProgressProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [hasScrolledOnce, setHasScrolledOnce] = useState(false);

  const isComplete = progress?.phase === 'complete';
  const isBuilding = !isComplete && isExecuting && !progress;
  // Orphaned state: at step 4 but nothing is running and no results exist
  const isStuck = !isComplete && !isExecuting && !progress && (!executionItems || executionItems.length === 0);
  const currentIndex = progress ? progress.current : 0;
  const total = progress ? Math.max(progress.total, 1) : 1;
  const percentage = progress ? Math.round((progress.current / total) * 100) : 0;

  // Build derived items — prefer B-075 items when available, else derive from plan + progress
  const items = useMemo<DerivedItem[]>(() => {
    // If B-075 execution items are provided, use them directly
    if (executionItems && executionItems.length > 0) {
      return executionItems.map((ei, i) => {
        let state: ItemState = 'pending';
        if (ei.status === 'success') state = 'success';
        else if (ei.status === 'skipped') state = 'skipped';
        else if (ei.status === 'error') {
          state = isCascadeError(ei.error) ? 'cascade' : 'error';
        }
        else if (i === currentIndex && !isComplete) state = 'in-progress';

        return {
          name: ei.parentName ? `${ei.parentName} / ${ei.name}` : ei.name,
          type: ei.type,
          parentName: ei.parentName,
          state,
          error: ei.error,
        };
      });
    }

    // Fallback: derive from plan
    if (!plan) return [];
    const derived: DerivedItem[] = [];
    for (const space of plan.spaces) {
      derived.push({ name: space.name, type: 'space', state: 'pending' });
      // Folderless lists
      if (space.lists) {
        for (const list of space.lists) {
          derived.push({
            name: `${space.name} / ${list.name}`,
            type: 'list',
            parentName: space.name,
            state: 'pending',
          });
        }
      }
      // Folders and their lists
      for (const folder of space.folders) {
        derived.push({
          name: `${space.name} / ${folder.name}`,
          type: 'folder',
          parentName: space.name,
          state: 'pending',
        });
        for (const list of folder.lists) {
          derived.push({
            name: `${folder.name} / ${list.name}`,
            type: 'list',
            parentName: folder.name,
            state: 'pending',
          });
        }
      }
    }

    // Apply states based on progress index
    return derived.map((item, i) => {
      let state: ItemState = 'pending';
      if (isComplete) {
        state = 'success';
      } else if (isBuilding) {
        state = 'in-progress';
      } else if (i < currentIndex) {
        state = 'success';
      } else if (i === currentIndex) {
        state = 'in-progress';
      }
      return { ...item, state };
    });
  }, [plan, executionItems, currentIndex, isComplete, isBuilding]);

  // Count stats
  const successCount = items.filter((i) => i.state === 'success').length;
  const realErrorCount = items.filter((i) => i.state === 'error').length;
  const cascadeCount = items.filter((i) => i.state === 'cascade').length;
  const skippedCount = items.filter((i) => i.state === 'skipped').length;
  const totalItems = items.length;
  const hasErrors = realErrorCount > 0;

  // Auto-scroll to keep active item visible
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.bottom > containerRect.bottom - 16 ||
        elementRect.top < containerRect.top + 16
      ) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tracking scroll state after auto-scrolling active item into view
      setHasScrolledOnce(true);
    }
  }, [currentIndex]);

  // Determine current phase for phase indicators
  const currentPhaseIdx = progress
    ? PHASE_ORDER.indexOf(progress.phase as (typeof PHASE_ORDER)[number])
    : -1;

  // Recovery UI: stuck at step 4 with no execution state
  if (isStuck) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full px-4 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Build interrupted</h2>
        <p className="text-sm text-text-secondary">
          It looks like the build was interrupted or this page was reloaded. You can retry the build to continue setting up your workspace.
        </p>
        <div className="flex items-center gap-3 mt-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Build
            </button>
          )}
          {onContinue && (
            <button
              onClick={onContinue}
              className="px-5 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-hover transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6 overflow-hidden">
      {/* Header - fixed height, no shrink */}
      <div className="py-5 text-center flex-shrink-0">
        {isComplete ? (
          <>
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3 animate-scale-in">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Workspace Built!</h2>
            <p className="text-sm text-text-secondary mt-1">
              {successCount + skippedCount} of {totalItems} items created
              {skippedCount > 0 && (
                <span className="text-text-muted"> ({skippedCount} already existed)</span>
              )}
              {hasErrors && (
                <span className="text-error"> ({realErrorCount} failed)</span>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-7 h-7 text-accent animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">
              Building your workspace...
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {isBuilding
                ? 'Creating your spaces, folders, and lists in ClickUp'
                : progress?.currentItem
                  ? `Creating ${progress.currentItem}`
                  : 'Starting...'}
            </p>
          </>
        )}
      </div>

      {/* Overall progress bar - fixed height */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-muted font-medium">
            {isComplete ? 'Complete' : 'Progress'}
          </span>
          <span className="text-xs font-semibold text-text-secondary tabular-nums font-mono">
            {isBuilding ? 'Working...' : `${progress ? progress.current : 0}/${total} (${percentage}%)`}
          </span>
        </div>
        <div className="h-2.5 bg-surface border border-border rounded-full overflow-hidden">
          {isBuilding ? (
            <div className="h-full w-1/3 rounded-full bg-accent animate-indeterminate" />
          ) : (
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isComplete
                  ? hasErrors
                    ? 'bg-warning'
                    : 'bg-success'
                  : 'bg-accent'
              }`}
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
      </div>

      {/* Phase indicators - fixed height */}
      <div className="flex items-center gap-1 mb-4 flex-shrink-0">
        {PHASE_ORDER.map((phase, i) => {
          const isDone = isComplete || currentPhaseIdx > i;
          const isCurrent = isBuilding ? i === 0 : currentPhaseIdx === i;

          return (
            <div key={phase} className="flex items-center flex-1">
              <div
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium
                  transition-all duration-300 w-full justify-center
                  ${isDone ? 'bg-success/10 text-success' : ''}
                  ${isCurrent ? 'bg-accent/10 text-accent' : ''}
                  ${!isDone && !isCurrent ? 'bg-surface/50 text-text-muted' : ''}
                `}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="hidden sm:inline truncate">
                  {PHASE_LABELS[phase]}
                </span>
              </div>
              {i < PHASE_ORDER.length - 1 && (
                <div
                  className={`w-1.5 h-0.5 rounded-full flex-shrink-0 mx-0.5 transition-colors duration-300 ${
                    isDone ? 'bg-success/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Item log - SCROLLABLE, takes remaining space */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-2 min-h-0"
      >
        <div className="space-y-0.5">
          {items.map((item, i) => {
            const isActive = item.state === 'in-progress' && !isBuilding;
            const isBuildingItem = isBuilding && item.state === 'in-progress';
            const isCascade = item.state === 'cascade';
            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                className={`
                  flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-sm
                  transition-all duration-300 ease-out
                  ${isActive ? 'bg-accent/10 border border-accent/20' : 'border border-transparent'}
                  ${isBuildingItem ? 'animate-pulse' : ''}
                  ${item.state === 'error' ? 'bg-error/5' : ''}
                  ${isCascade ? 'bg-warning/5 opacity-70' : ''}
                  ${item.state === 'success' ? 'animate-item-done' : ''}
                  ${item.state === 'skipped' ? 'opacity-60' : ''}
                  ${item.state === 'pending' ? 'opacity-50' : ''}
                `}
                style={{
                  animationDelay: isBuildingItem
                    ? `${i * 150}ms`
                    : item.state === 'success' && hasScrolledOnce
                      ? '0ms'
                      : `${i * 30}ms`,
                }}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {item.state === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  )}
                  {item.state === 'skipped' && (
                    <SkipForward className="w-4 h-4 text-text-muted" />
                  )}
                  {item.state === 'in-progress' && !isBuilding && (
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  )}
                  {isBuildingItem && (
                    <Circle className="w-4 h-4 text-accent/60" />
                  )}
                  {item.state === 'error' && (
                    <XCircle className="w-4 h-4 text-error" />
                  )}
                  {isCascade && (
                    <Info className="w-4 h-4 text-warning/70" />
                  )}
                  {item.state === 'pending' && (
                    <Circle className="w-4 h-4 text-text-muted/60" />
                  )}
                </div>

                {/* Type icon */}
                <div
                  className={`flex-shrink-0 ${
                    isBuildingItem
                      ? 'text-accent/60'
                      : item.state === 'in-progress'
                      ? 'text-accent'
                      : item.state === 'success'
                      ? 'text-text-secondary'
                      : item.state === 'skipped'
                      ? 'text-text-muted/60'
                      : item.state === 'error'
                      ? 'text-error/60'
                      : isCascade
                      ? 'text-warning/50'
                      : 'text-text-muted/60'
                  }`}
                >
                  {TYPE_ICONS[item.type]}
                </div>

                {/* Item name */}
                <span
                  className={`truncate ${
                    isBuildingItem
                      ? 'text-text-secondary'
                      : item.state === 'in-progress'
                      ? 'text-text-primary font-medium'
                      : item.state === 'success'
                      ? 'text-text-secondary'
                      : item.state === 'skipped'
                      ? 'text-text-muted/70'
                      : item.state === 'error'
                      ? 'text-error/80'
                      : isCascade
                      ? 'text-warning/70'
                      : 'text-text-muted'
                  }`}
                >
                  {item.name}
                </span>

                {/* Type badge */}
                <span
                  className={`text-[11px] font-medium ml-auto flex-shrink-0 uppercase tracking-wider ${
                    item.state === 'skipped'
                      ? 'text-text-muted/50'
                      : isBuildingItem
                      ? 'text-accent/50'
                      : item.state === 'in-progress'
                      ? 'text-accent/70'
                      : item.state === 'success'
                      ? 'text-text-muted'
                      : item.state === 'error'
                      ? 'text-error/50'
                      : isCascade
                      ? 'text-warning/40'
                      : 'text-text-muted/60'
                  }`}
                >
                  {item.state === 'skipped' ? 'exists' : isCascade ? 'skipped' : item.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error + cascade summary - fixed at bottom, scrollable if tall */}
      {isComplete && (hasErrors || cascadeCount > 0) && (
        <div className="mt-3 flex-shrink-0 max-h-40 overflow-y-auto space-y-2">
          {/* Root errors */}
          {hasErrors && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-error" />
                <p className="text-sm font-medium text-error">
                  {realErrorCount} item{realErrorCount !== 1 ? 's' : ''} failed
                </p>
              </div>
              <div className="space-y-1">
                {items
                  .filter((i) => i.state === 'error')
                  .map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-error/80 pl-1"
                    >
                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="font-medium">{item.name}</span>
                        {item.error && (
                          <span className="text-error/60">: {item.error}</span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cascade info (not errors, just informational) */}
          {cascadeCount > 0 && (
            <div className="bg-warning/5 border border-warning/15 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-warning/70" />
                <p className="text-xs text-warning/80">
                  {cascadeCount} item{cascadeCount !== 1 ? 's were' : ' was'} skipped because {cascadeCount !== 1 ? 'their' : 'its'} parent failed to create.
                  Retrying the failed items will also create these.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legacy error display (from progress.errors) */}
      {progress &&
        progress.errors.length > 0 &&
        !hasErrors && cascadeCount === 0 && (
          <div className="mt-3 bg-error/10 border border-error/20 rounded-xl p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-error" />
              <p className="text-sm font-medium text-error">Errors</p>
            </div>
            {progress.errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-error/80 pl-1"
              >
                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

      {/* Action buttons - ALWAYS visible at bottom */}
      {isComplete && (onRetry || onContinue) && (
        <div className="mt-4 flex items-center justify-center gap-3 flex-shrink-0">
          {hasErrors && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Failed Items
            </button>
          )}
          {hasErrors && onContinue && (
            <button
              onClick={onContinue}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-hover transition-colors"
            >
              Continue Anyway
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {!hasErrors && onContinue && (
            <button
              onClick={onContinue}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
