'use client';

import { useState } from 'react';
import { LayoutDashboard, Plus, ArrowRight } from 'lucide-react';

export interface DashboardChoice {
  id: string;
  type: 'new_dashboard' | 'existing_dashboard';
  label: string;
  dashboardName?: string;
  dashboardId?: string;
}

interface DashboardChoiceButtonsProps {
  choices: DashboardChoice[];
  onSelect: (choice: DashboardChoice) => void;
  selected?: string | null;
}

export default function DashboardChoiceButtons({
  choices,
  onSelect,
  selected,
}: DashboardChoiceButtonsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isLocked = selected != null;

  return (
    <div className="my-3 space-y-2">
      <p className="text-xs text-text-muted px-1">Choose an option:</p>
      <div className="flex flex-col gap-2">
        {choices.map((choice) => {
          const isSelected = selected === choice.id;
          const isNew = choice.type === 'new_dashboard';
          const isHovered = hoveredId === choice.id;

          return (
            <button
              key={choice.id}
              onClick={() => !isLocked && onSelect(choice)}
              onMouseEnter={() => setHoveredId(choice.id)}
              onMouseLeave={() => setHoveredId(null)}
              disabled={isLocked && !isSelected}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                isSelected
                  ? 'border-accent bg-accent/10 text-text-primary'
                  : isLocked
                    ? 'border-border/50 bg-surface/30 text-text-muted opacity-50 cursor-not-allowed'
                    : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-hover text-text-secondary hover:text-text-primary cursor-pointer'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-accent/20'
                    : isHovered
                      ? 'bg-accent/10'
                      : 'bg-navy-dark/40'
                }`}
              >
                {isNew ? (
                  <Plus className={`w-4 h-4 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                ) : (
                  <LayoutDashboard
                    className={`w-4 h-4 ${isSelected ? 'text-accent' : 'text-text-muted'}`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{choice.label}</p>
                {choice.dashboardName && (
                  <p className="text-xs text-text-muted truncate">{choice.dashboardName}</p>
                )}
              </div>
              {!isLocked && (
                <ArrowRight
                  className={`w-4 h-4 shrink-0 transition-opacity ${
                    isHovered ? 'opacity-100 text-accent' : 'opacity-0'
                  }`}
                />
              )}
              {isSelected && (
                <span className="text-xs text-accent font-medium shrink-0">Selected</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
