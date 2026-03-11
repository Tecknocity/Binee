'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  LayoutGrid,
  Settings,
  Tag,
  ArrowRight,
} from 'lucide-react';
import type { ManualStep, ExecutionResult } from '@/lib/setup/session';

interface ManualStepsGuideProps {
  steps: ManualStep[];
  executionResult: ExecutionResult | null;
  onMarkComplete: (index: number) => void;
  onDone: () => void;
  onSkipAll: () => void;
}

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  automation: {
    icon: <Zap className="w-3 h-3" />,
    label: 'Automation',
    color: 'bg-yellow-400/15 text-yellow-400',
  },
  view: {
    icon: <LayoutGrid className="w-3 h-3" />,
    label: 'View',
    color: 'bg-blue-400/15 text-blue-400',
  },
  setting: {
    icon: <Settings className="w-3 h-3" />,
    label: 'Setting',
    color: 'bg-emerald-400/15 text-emerald-400',
  },
  custom_field: {
    icon: <Tag className="w-3 h-3" />,
    label: 'Custom Field',
    color: 'bg-purple-400/15 text-purple-400',
  },
};

export function ManualStepsGuide({
  steps,
  executionResult,
  onMarkComplete,
  onDone,
  onSkipAll,
}: ManualStepsGuideProps) {
  const completedCount = steps.filter((s) => s.completed).length;
  const allDone = completedCount === steps.length;

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6">
      {/* Header */}
      <div className="py-4">
        <h2 className="text-xl font-semibold text-text-primary">Finishing Touches</h2>
        <p className="text-sm text-text-secondary mt-1">
          These steps require manual configuration in ClickUp. Complete them at your own pace.
        </p>
        {executionResult && (
          <div className="mt-3 bg-success/10 border border-success/20 rounded-lg px-3 py-2 text-sm text-success">
            Successfully created {executionResult.itemsCreated} items in your workspace.
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-surface border border-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / Math.max(steps.length, 1)) * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
          {completedCount} of {steps.length} completed
        </span>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} onToggle={() => onMarkComplete(i)} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button
          onClick={onSkipAll}
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onDone}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
            allDone
              ? 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20'
              : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {allDone ? 'Go to Dashboard' : 'Continue to Dashboard'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Card
// ---------------------------------------------------------------------------

function StepCard({
  step,
  index,
  onToggle,
}: {
  step: ManualStep;
  index: number;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[step.category] || CATEGORY_META.setting;

  return (
    <div
      className={`bg-surface border rounded-xl overflow-hidden transition-colors ${
        step.completed ? 'border-success/20' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
            step.completed
              ? 'bg-success border-success text-white'
              : 'border-border hover:border-accent/40'
          }`}
        >
          {step.completed && <Check className="w-3 h-3" />}
        </button>

        {/* Title & badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                step.completed ? 'text-text-muted line-through' : 'text-text-primary'
              }`}
            >
              {step.title}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>
              {meta.icon}
              {meta.label}
            </span>
          </div>
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Instructions */}
      {expanded && (
        <div className="px-4 pb-3 pt-0">
          <ol className="space-y-1.5 ml-8">
            {step.instructions.map((instruction, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                <span className="text-text-muted text-xs font-medium mt-0.5 w-4 flex-shrink-0 text-right">
                  {i + 1}.
                </span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
