'use client';

import { CheckCircle2, MessageSquare, GitPullRequest, AlertCircle, Clock, UserPlus } from 'lucide-react';
import { getRecentActivityData } from '@/hooks/useDashboard';

const activityIcons: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  commented: MessageSquare,
  created: GitPullRequest,
  flagged: AlertCircle,
  updated: Clock,
  assigned: UserPlus,
};

const activityColors: Record<string, string> = {
  completed: 'text-success bg-success/10',
  commented: 'text-info bg-info/10',
  created: 'text-accent bg-accent/10',
  flagged: 'text-error bg-error/10',
  updated: 'text-warning bg-warning/10',
  assigned: 'text-text-secondary bg-surface-hover',
};

interface RecentActivityWidgetProps {
  title?: string;
}

export default function RecentActivityWidget({ title }: RecentActivityWidgetProps) {
  const data = getRecentActivityData();

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
      {data.map((activity) => {
        const Icon = activityIcons[activity.type] ?? Clock;
        const colorClass = activityColors[activity.type] ?? 'text-text-muted bg-surface-hover';

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 px-1 py-2.5 rounded-lg hover:bg-surface-hover/50 transition-colors"
          >
            <div className={`rounded-lg p-1.5 mt-0.5 flex-shrink-0 ${colorClass}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary leading-snug">
                <span className="font-medium">{activity.user}</span>{' '}
                <span className="text-text-secondary">{activity.action}</span>{' '}
                <span className="font-medium">{activity.target}</span>
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">{activity.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
