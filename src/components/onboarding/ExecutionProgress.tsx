'use client';

import { useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  FolderOpen,
  Folder,
  List,
  CheckSquare,
  FileText,
  Sparkles,
} from 'lucide-react';
import type { ExecutionProgress as ExecutionProgressType, ExecutionResult } from '@/lib/setup/session';
import type { SetupPlan } from '@/lib/setup/types';

interface ExecutionProgressProps {
  progress: ExecutionProgressType | null;
  result: ExecutionResult | null;
  plan: SetupPlan | null;
}

const PHASE_LABELS: Record<string, string> = {
  creating_spaces: 'Creating Spaces',
  creating_folders: 'Creating Folders',
  creating_lists: 'Creating Lists',
  creating_tasks: 'Creating Tasks',
  creating_docs: 'Creating Documents',
  complete: 'Complete',
};

const PHASE_ICONS: Record<string, React.ReactNode> = {
  creating_spaces: <FolderOpen className="w-4 h-4" />,
  creating_folders: <Folder className="w-4 h-4" />,
  creating_lists: <List className="w-4 h-4" />,
  creating_tasks: <CheckSquare className="w-4 h-4" />,
  creating_docs: <FileText className="w-4 h-4" />,
  complete: <CheckCircle2 className="w-4 h-4" />,
};

export function ExecutionProgress({ progress, result, plan }: ExecutionProgressProps) {
  const percentage = progress ? Math.round((progress.current / Math.max(progress.total, 1)) * 100) : 0;
  const isComplete = progress?.phase === 'complete';

  // Build a flat list of all items for the log
  const allItems = useMemo(() => {
    if (!plan) return [];
    const items: Array<{ name: string; type: string }> = [];
    for (const space of plan.spaces) {
      items.push({ name: space.name, type: 'space' });
      for (const folder of space.folders) {
        items.push({ name: `${space.name} / ${folder.name}`, type: 'folder' });
        for (const list of folder.lists) {
          items.push({ name: `${folder.name} / ${list.name}`, type: 'list' });
        }
      }
    }
    return items;
  }, [plan]);

  const currentIndex = progress ? progress.current : 0;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6">
      {/* Header */}
      <div className="py-6 text-center">
        {isComplete ? (
          <>
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Workspace Built!</h2>
            <p className="text-sm text-text-secondary mt-1">
              Created {result?.itemsCreated ?? 0} of {result?.itemsTotal ?? 0} items
              {result && result.errors.length > 0 && ` (${result.errors.length} errors)`}
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-7 h-7 text-accent animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Building your workspace...</h2>
            <p className="text-sm text-text-secondary mt-1">
              {progress ? PHASE_LABELS[progress.phase] : 'Starting...'}
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
              isComplete ? 'bg-success' : 'bg-accent'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Phase indicators */}
      <div className="flex items-center justify-between mb-4 px-2">
        {Object.keys(PHASE_LABELS)
          .filter((p) => p !== 'complete')
          .map((phase) => {
            const phases = ['creating_spaces', 'creating_folders', 'creating_lists', 'creating_tasks', 'creating_docs'];
            const phaseIdx = phases.indexOf(phase);
            const currentPhaseIdx = progress ? phases.indexOf(progress.phase) : -1;
            const isDone = isComplete || currentPhaseIdx > phaseIdx;
            const isCurrent = progress?.phase === phase;

            return (
              <div
                key={phase}
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isDone ? 'text-success' : isCurrent ? 'text-accent' : 'text-text-muted'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{PHASE_LABELS[phase]?.replace('Creating ', '')}</span>
              </div>
            );
          })}
      </div>

      {/* Item log */}
      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-3 min-h-0">
        <div className="space-y-1">
          {allItems.map((item, i) => {
            const isDone = i < currentIndex;
            const isCurrent = i === currentIndex && !isComplete;
            const isPending = i > currentIndex && !isComplete;

            return (
              <div
                key={i}
                className={`flex items-center gap-2 py-1 px-2 rounded-md text-sm transition-colors ${
                  isCurrent ? 'bg-accent/10' : ''
                }`}
              >
                {isDone || (isComplete && i < (result?.itemsTotal ?? 0)) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" />
                ) : isPending ? (
                  <Circle className="w-3.5 h-3.5 text-text-muted/40 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                )}
                <span
                  className={`truncate ${
                    isDone || isComplete
                      ? 'text-text-secondary'
                      : isCurrent
                      ? 'text-text-primary font-medium'
                      : 'text-text-muted/60'
                  }`}
                >
                  {item.name}
                </span>
                <span
                  className={`text-[10px] ml-auto flex-shrink-0 ${
                    isDone || isComplete ? 'text-text-muted' : isCurrent ? 'text-accent' : 'text-text-muted/40'
                  }`}
                >
                  {item.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Errors */}
      {progress && progress.errors.length > 0 && (
        <div className="mt-3 bg-error/10 border border-error/20 rounded-xl p-3">
          <p className="text-sm font-medium text-error mb-1">Errors</p>
          {progress.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-error/80">
              <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
