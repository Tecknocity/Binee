'use client';

import { Target } from 'lucide-react';
import { getSprintProgressData } from '@/hooks/useDashboard';

interface ProgressWidgetProps {
  title?: string;
}

export default function ProgressWidget({ title }: ProgressWidgetProps) {
  const data = getSprintProgressData();

  return (
    <div className="space-y-5">
      {data.map((sprint) => {
        const pct = sprint.total > 0 ? (sprint.completed / sprint.total) * 100 : 0;
        const isOnTrack = pct >= sprint.expectedPct;

        return (
          <div key={sprint.name}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text-primary">{sprint.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {sprint.completed}/{sprint.total} tasks
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isOnTrack
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {isOnTrack ? 'On Track' : 'Behind'}
                </span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-navy-base overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 relative"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isOnTrack
                    ? 'var(--color-success)'
                    : 'var(--color-warning)',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-text-muted">
                {sprint.daysLeft} days remaining
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">
                {pct.toFixed(0)}% complete
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
