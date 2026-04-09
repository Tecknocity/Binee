'use client';

import { useState, useEffect } from 'react';
import { Sparkles, LayoutGrid, List, FolderOpen, Tags } from 'lucide-react';

const STAGES = [
  { label: 'Understanding your business', icon: Sparkles },
  { label: 'Designing workspace spaces', icon: LayoutGrid },
  { label: 'Organizing folders and lists', icon: FolderOpen },
  { label: 'Adding statuses and details', icon: List },
  { label: 'Finalizing your plan', icon: Tags },
];

// Interval between stage transitions (ms)
const STAGE_INTERVAL = 3200;

export function GeneratingWorkspace() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, STAGE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
      {/* Animated icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Sparkles className="w-9 h-9 text-accent animate-pulse" />
        </div>
        {/* Orbiting dot */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-lg shadow-accent/40" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Designing your workspace
        </h2>
        <p className="text-sm text-text-secondary max-w-sm">
          Binee is creating a custom ClickUp structure based on your business
        </p>
      </div>

      {/* Stage progress */}
      <div className="w-full max-w-xs space-y-2.5">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isDone = i < activeStage;
          const isActive = i === activeStage;
          const isPending = i > activeStage;

          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                isActive
                  ? 'bg-accent/10 border border-accent/25'
                  : isDone
                    ? 'bg-surface/50 border border-transparent'
                    : 'border border-transparent opacity-40'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : isDone
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-border/30 text-text-muted'
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'animate-pulse' : ''}`} />
                )}
              </div>
              <span
                className={`text-sm font-medium transition-colors duration-500 ${
                  isActive
                    ? 'text-text-primary'
                    : isDone
                      ? 'text-text-secondary'
                      : 'text-text-muted'
                }${isPending ? '' : ''}`}
              >
                {stage.label}
                {isActive && (
                  <span className="inline-flex ml-1">
                    <span className="animate-bounce inline-block [animation-delay:0ms]">.</span>
                    <span className="animate-bounce inline-block [animation-delay:150ms]">.</span>
                    <span className="animate-bounce inline-block [animation-delay:300ms]">.</span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom shimmer bar */}
      <div className="w-full max-w-xs">
        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent/60 via-accent to-accent/60 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(((activeStage + 1) / STAGES.length) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
