'use client';

import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { HealthIssue } from '@/types/database';

interface IssueCardProps {
  issue: HealthIssue;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: 'text-error',
    bg: 'bg-error/10',
    border: 'border-error/20',
    badge: 'bg-error/15 text-error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    badge: 'bg-warning/15 text-warning',
  },
  info: {
    icon: Info,
    color: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/20',
    badge: 'bg-info/15 text-info',
  },
};

export default function IssueCard({ issue }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-xl border ${config.border} bg-surface p-4 transition-all hover:bg-surface-hover`}
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`mt-0.5 rounded-lg p-2 ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-text-primary">{issue.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
              {issue.severity}
            </span>
            {issue.affected_items.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-text-secondary">
                {issue.affected_items.length} affected
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{issue.description}</p>
        </div>
        <button className="mt-1 text-text-muted hover:text-text-secondary transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 ml-11 pt-3 border-t border-border">
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider shrink-0 mt-0.5">
              Suggestion
            </span>
            <p className="text-sm text-text-secondary">{issue.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}
