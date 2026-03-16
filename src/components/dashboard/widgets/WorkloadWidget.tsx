'use client';

import { getWorkloadData } from '@/hooks/useDashboard';

interface WorkloadWidgetProps {
  title?: string;
}

export default function WorkloadWidget({ title }: WorkloadWidgetProps) {
  const data = getWorkloadData();
  const maxTasks = Math.max(...data.map((d) => d.total));

  return (
    <div className="space-y-4">
      {data.map((member) => {
        const completedPct = maxTasks > 0 ? (member.completed / maxTasks) * 100 : 0;
        const inProgressPct = maxTasks > 0 ? (member.inProgress / maxTasks) * 100 : 0;
        const overduePct = maxTasks > 0 ? (member.overdue / maxTasks) * 100 : 0;

        return (
          <div key={member.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text-primary font-medium">{member.name}</span>
              <span className="text-xs text-text-muted tabular-nums">
                {member.total} tasks
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-navy-base gap-px">
              {member.completed > 0 && (
                <div
                  className="h-full rounded-l-full"
                  style={{ width: `${completedPct}%`, backgroundColor: 'var(--color-success)' }}
                  title={`${member.completed} completed`}
                />
              )}
              {member.inProgress > 0 && (
                <div
                  className="h-full"
                  style={{ width: `${inProgressPct}%`, backgroundColor: 'var(--color-accent)' }}
                  title={`${member.inProgress} in progress`}
                />
              )}
              {member.overdue > 0 && (
                <div
                  className="h-full rounded-r-full"
                  style={{ width: `${overduePct}%`, backgroundColor: 'var(--color-error)' }}
                  title={`${member.overdue} overdue`}
                />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-success" /> Completed
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-accent" /> In Progress
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-error" /> Overdue
        </div>
      </div>
    </div>
  );
}
