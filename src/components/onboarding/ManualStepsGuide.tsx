'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Zap,
  LayoutGrid,
  Settings2,
  Columns3,
  ArrowRight,
} from 'lucide-react';
import type { ManualStep } from '@/lib/setup/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManualStepsGuideProps {
  steps: ManualStep[];
  onMarkComplete: (index: number) => void;
  onFinish: () => void;
}

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  automation: <Zap className="w-4 h-4" />,
  view: <LayoutGrid className="w-4 h-4" />,
  setting: <Settings2 className="w-4 h-4" />,
  custom_field: <Columns3 className="w-4 h-4" />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualStepsGuide({ steps, onMarkComplete, onFinish }: ManualStepsGuideProps) {
  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6 overflow-hidden">
      {/* Header */}
      <div className="py-6 text-center shrink-0">
        <h2 className="text-xl font-semibold text-text-primary">Final Setup Steps</h2>
        <p className="text-sm text-text-secondary mt-1">
          These steps can&apos;t be automated — complete them manually in ClickUp
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="h-2 w-40 bg-surface border border-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-text-muted font-mono">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
        {steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} onToggle={() => onMarkComplete(i)} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
        <button
          onClick={onFinish}
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip all &rarr; Go to Chat
        </button>

        <button
          onClick={onFinish}
          disabled={!allDone}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors
            ${allDone
              ? 'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20'
              : 'bg-surface border border-border text-text-muted cursor-not-allowed'
            }`}
        >
          {allDone ? 'Finish Setup' : `Complete all steps (${completedCount}/${totalCount})`}
          {allDone && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Card (expandable)
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

  return (
    <div
      className={`border rounded-xl transition-colors ${
        step.completed ? 'border-success/20 bg-success/5' : 'border-border bg-surface'
      }`}
    >
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {/* Expand chevron */}
        <div className="text-text-muted flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Category icon */}
        <div className={step.completed ? 'text-success' : 'text-text-muted'}>
          {CATEGORY_ICONS[step.category] || <Settings2 className="w-4 h-4" />}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              step.completed ? 'text-success line-through' : 'text-text-primary'
            }`}
          >
            {index + 1}. {step.title}
          </p>
          <p className="text-xs text-text-muted truncate">{step.description}</p>
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex-shrink-0"
        >
          {step.completed ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <Circle className="w-5 h-5 text-text-muted/60 hover:text-accent transition-colors" />
          )}
        </button>
      </button>

      {/* Expanded instructions */}
      {expanded && (
        <div className="px-3 pb-3 ml-7">
          <div className="border-t border-border/50 pt-3 space-y-2">
            {step.instructions.map((instruction, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-xs font-semibold text-accent bg-accent/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">{instruction}</p>
              </div>
            ))}
          </div>

          {step.clickupLink && (
            <a
              href={step.clickupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Open in ClickUp <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
