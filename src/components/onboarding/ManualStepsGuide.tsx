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
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="max-w-2xl mx-auto w-full px-4 flex flex-col flex-1 min-h-0">
        {/* Header with prominent progress */}
        <div className="py-6 shrink-0">
          <h2 className="text-xl font-semibold text-[#F0F0F5] text-center">Final Setup Steps</h2>
          <p className="text-sm text-[#A0A0B5] mt-1 text-center">
            These steps can&apos;t be automated. Complete them manually in ClickUp.
          </p>

          {/* Progress bar - prominent */}
          <div className="mt-4 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#A0A0B5]">
                {allDone ? 'All steps complete!' : `${completedCount} of ${totalCount} completed`}
              </span>
              <span className="text-xs font-semibold text-[#854DF9] font-mono">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2.5 bg-[#2A2A3A] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  allDone ? 'bg-success' : 'bg-[#854DF9]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
          {steps.map((step, i) => (
            <StepCard key={i} step={step} index={i} onToggle={() => onMarkComplete(i)} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between py-4 border-t border-[#2A2A3A] shrink-0">
          <button
            onClick={onFinish}
            className="text-sm text-[#6B6B80] hover:text-[#A0A0B5] transition-colors"
          >
            Skip for now
          </button>

          <button
            onClick={onFinish}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors
              ${allDone
                ? 'bg-[#854DF9] text-white hover:bg-[#9D6FFA]'
                : 'bg-[#12121A] border border-[#2A2A3A] text-[#6B6B80] cursor-not-allowed'
              }`}
            disabled={!allDone}
          >
            {allDone ? (
              <>
                Finish Setup
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              `Complete all steps (${completedCount}/${totalCount})`
            )}
          </button>
        </div>
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
      className={`border rounded-xl transition-all duration-200 ${
        step.completed ? 'border-success/20 bg-success/5' : 'border-[#2A2A3A] bg-[#12121A]'
      }`}
    >
      {/* Header - click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Expand chevron */}
        <div className="text-[#6B6B80] flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Category icon */}
        <div className={`flex-shrink-0 ${step.completed ? 'text-success' : 'text-[#6B6B80]'}`}>
          {CATEGORY_ICONS[step.category] || <Settings2 className="w-4 h-4" />}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              step.completed ? 'text-success line-through' : 'text-[#F0F0F5]'
            }`}
          >
            {index + 1}. {step.title}
          </p>
          <p className="text-xs text-[#6B6B80] truncate mt-0.5">{step.description}</p>
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
            <Circle className="w-5 h-5 text-[#6B6B80]/60 hover:text-[#854DF9] transition-colors" />
          )}
        </button>
      </button>

      {/* Expanded instructions */}
      {expanded && (
        <div className="px-4 pb-4 ml-7">
          <div className="border-t border-[#2A2A3A]/50 pt-3 space-y-2.5">
            {step.instructions.map((instruction, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-xs font-semibold text-[#854DF9] bg-[#854DF9]/10 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-[#A0A0B5] leading-relaxed">{instruction}</p>
              </div>
            ))}
          </div>

          {step.clickupLink && (
            <a
              href={step.clickupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#854DF9] hover:text-[#9D6FFA] transition-colors"
            >
              Open in ClickUp <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
