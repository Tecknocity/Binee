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
  Tag,
  FileText,
  Target,
  Clock,
} from 'lucide-react';
import type { ExecutionProgress as ExecutionProgressType, ExecutionResult, SetupPlan } from '@/lib/setup/types';
import type { ExecutionItem } from '@/lib/setup/executor';
import type { EnrichmentJobView, EnrichmentSummary } from '@/stores/setupStore';
import { formatEtaMinutes } from '@/lib/setup/eta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemState = 'pending' | 'in-progress' | 'success' | 'error' | 'cascade' | 'skipped';

interface DerivedItem {
  name: string;
  type: 'space' | 'folder' | 'list' | 'tag' | 'doc' | 'goal';
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
  // Queue-backed enrichment props
  buildStartedAt?: string | null;
  buildEstimatedCompletionAt?: string | null;
  buildEtaMinutes?: number | null;
  buildStatus?: 'enriching' | 'completed' | 'failed' | 'cancelled' | null;
  enrichmentJobs?: EnrichmentJobView[];
  enrichmentSummary?: EnrichmentSummary;
  onRetryEnrichmentJob?: (jobId: string) => void | Promise<void>;
  onRetryAllFailedEnrichment?: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  'creating_spaces',
  'creating_folders',
  'creating_lists',
  'creating_tags',
  'creating_docs',
] as const;

const PHASE_LABELS: Record<string, string> = {
  creating_spaces: 'Spaces',
  creating_folders: 'Folders',
  creating_lists: 'Lists',
  creating_tags: 'Tags',
  creating_docs: 'Docs',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  space: <FolderOpen className="w-3.5 h-3.5" />,
  folder: <Folder className="w-3.5 h-3.5" />,
  list: <List className="w-3.5 h-3.5" />,
  tag: <Tag className="w-3.5 h-3.5" />,
  doc: <FileText className="w-3.5 h-3.5" />,
  goal: <Target className="w-3.5 h-3.5" />,
};

/** Detect cascade errors (child failed because parent failed, not a real error) */
function isCascadeError(error?: string): boolean {
  if (!error) return false;
  return error.startsWith('Skipped: parent ');
}

/** Detect items skipped due to ClickUp plan limitations */
function isPlanLimitationSkip(item: { status: string; error?: string }): boolean {
  return item.status === 'skipped' && !!item.error && item.error.includes('not available on the');
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
  buildStartedAt,
  buildEstimatedCompletionAt,
  buildEtaMinutes,
  buildStatus,
  enrichmentJobs,
  enrichmentSummary,
  onRetryEnrichmentJob,
  onRetryAllFailedEnrichment,
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

  // Detect plan-limitation skipped items (from executor smart skip)
  const planSkippedItems = executionItems?.filter(isPlanLimitationSkip) ?? [];
  const hasPlanSkips = planSkippedItems.length > 0;

  // Format the "Started at HH:MM" timestamp for the ETA banner. Hooks must
  // run unconditionally on every render, so this lives above the early
  // returns below.
  const startedAtLabel = useMemo(() => {
    if (!buildStartedAt) return null;
    try {
      const d = new Date(buildStartedAt);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [buildStartedAt]);

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

  const showEtaBanner = !!buildStartedAt && buildStatus !== 'completed' && buildStatus !== null;

  // Enrichment job stats for the lower section
  const enrichJobs = enrichmentJobs ?? [];
  const enrichSummary = enrichmentSummary ?? { pending: 0, in_progress: 0, done: 0, failed: 0 };
  const enrichTotal = enrichJobs.length;
  const enrichDone = enrichSummary.done;
  const enrichFailed = enrichSummary.failed;
  const enrichInProgress = enrichSummary.in_progress;
  const enrichPending = enrichSummary.pending;
  const showEnrichmentSection = enrichTotal > 0 || buildStatus === 'enriching';

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

      {/* ETA banner - shown while a queue-backed build is active. Tells the
          user when the build started, the rough completion time, and that they
          can leave the page. */}
      {showEtaBanner && (
        <div className="mb-4 flex-shrink-0 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {startedAtLabel && (
                  <span className="text-text-secondary">
                    Started at <span className="font-mono text-text-primary">{startedAtLabel}</span>
                  </span>
                )}
                {typeof buildEtaMinutes === 'number' && buildEtaMinutes > 0 && (
                  <span className="text-text-secondary">
                    Estimated completion: <span className="text-text-primary">{formatEtaMinutes(buildEtaMinutes)}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1">
                You can leave this page. We will keep building in the background and you can come back any time to check progress.
              </p>
            </div>
            {buildEstimatedCompletionAt && (
              <span className="text-[11px] text-text-muted hidden sm:inline">
                ETA {new Date(buildEstimatedCompletionAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

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

      {/* Error + cascade + plan limitation summary - fixed at bottom, scrollable if tall */}
      {isComplete && (hasErrors || cascadeCount > 0 || hasPlanSkips) && (
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

          {/* Plan limitation skips */}
          {hasPlanSkips && (
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-accent">
                    {planSkippedItems.length} item{planSkippedItems.length !== 1 ? 's' : ''} skipped due to plan limitations
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {planSkippedItems[0].error || 'Upgrade your ClickUp plan to unlock these features.'}
                  </p>
                </div>
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

      {/* Enrichment section: per-list / per-doc tasks generated and written to
          ClickUp by the queue worker. Hydrates from polling. */}
      {showEnrichmentSection && (
        <div className="mt-4 flex-shrink-0 bg-surface border border-border rounded-xl p-3 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-sm font-medium text-text-primary">
                Populating tasks and docs
              </p>
            </div>
            <p className="text-xs text-text-muted tabular-nums font-mono">
              {enrichDone}/{enrichTotal} done
              {enrichFailed > 0 && (
                <span className="text-error ml-2">{enrichFailed} failed</span>
              )}
            </p>
          </div>
          {enrichTotal === 0 ? (
            <p className="text-xs text-text-muted py-2">
              {buildStatus === 'enriching'
                ? 'Queueing enrichment work...'
                : 'No enrichment work for this build.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {enrichJobs.map((job) => (
                <EnrichmentRow
                  key={job.id}
                  job={job}
                  onRetry={onRetryEnrichmentJob}
                />
              ))}
            </div>
          )}
          {enrichFailed > 0 && onRetryAllFailedEnrichment && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => void onRetryAllFailedEnrichment()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry all failed
              </button>
            </div>
          )}
          {(enrichInProgress > 0 || enrichPending > 0) && (
            <p className="text-[11px] text-text-muted mt-2">
              {enrichInProgress > 0 ? `${enrichInProgress} working` : null}
              {enrichInProgress > 0 && enrichPending > 0 ? ' • ' : ''}
              {enrichPending > 0 ? `${enrichPending} queued` : null}
            </p>
          )}
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

// ---------------------------------------------------------------------------
// EnrichmentRow: one row in the enrichment job list
// ---------------------------------------------------------------------------

interface EnrichmentRowProps {
  job: EnrichmentJobView;
  onRetry?: (jobId: string) => void | Promise<void>;
}

function EnrichmentRow({ job, onRetry }: EnrichmentRowProps) {
  const isList = job.type === 'list_tasks';
  const isDoc = job.type === 'doc_content';
  const isViews = job.type === 'list_views';

  const typeLabel = isList ? 'tasks' : isDoc ? 'doc' : isViews ? 'views' : job.type;
  const displayName = job.parent_name
    ? `${job.parent_name} / ${job.target_name}`
    : job.target_name;

  let icon: React.ReactNode;
  let textCls = 'text-text-secondary';
  let extra: string | null = null;

  switch (job.status) {
    case 'done':
      icon = <CheckCircle2 className="w-4 h-4 text-success" />;
      if (isList && job.result && typeof job.result.tasksCreated === 'number') {
        extra = `${job.result.tasksCreated} task${job.result.tasksCreated === 1 ? '' : 's'}`;
      } else if (isDoc) {
        extra = 'content written';
      } else if (isViews && job.result && typeof job.result.viewsCreated === 'number') {
        extra = `${job.result.viewsCreated} view${job.result.viewsCreated === 1 ? '' : 's'}`;
      }
      break;
    case 'in_progress':
      icon = <Loader2 className="w-4 h-4 text-accent animate-spin" />;
      textCls = 'text-text-primary font-medium';
      extra = 'working...';
      break;
    case 'failed':
      icon = <XCircle className="w-4 h-4 text-error" />;
      textCls = 'text-error/80';
      break;
    case 'pending':
    default:
      icon = <Circle className="w-4 h-4 text-text-muted/60" />;
      textCls = 'text-text-muted';
      extra = 'queued';
      break;
  }

  return (
    <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-sm hover:bg-surface-hover/50">
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</div>
      <div className="flex-shrink-0 text-text-muted/60">
        {isDoc ? <FileText className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
      </div>
      <span className={`truncate ${textCls}`}>{displayName}</span>
      <span className="text-[11px] uppercase tracking-wider text-text-muted/50 ml-auto flex-shrink-0">
        {typeLabel}
      </span>
      {extra && (
        <span className="text-[11px] text-text-muted/70 flex-shrink-0">
          {extra}
        </span>
      )}
      {job.status === 'failed' && (
        <span
          className="text-[11px] text-error/70 truncate max-w-[200px]"
          title={job.last_error ?? undefined}
        >
          {job.last_error?.slice(0, 60) ?? 'failed'}
        </span>
      )}
      {job.status === 'failed' && onRetry && (
        <button
          onClick={() => void onRetry(job.id)}
          className="flex-shrink-0 p-1 text-accent hover:bg-accent/10 rounded transition-colors"
          title="Retry this item"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
