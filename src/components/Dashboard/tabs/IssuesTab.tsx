import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Zap, CheckCircle2, Clock, XCircle, Filter, ArrowUpDown, Check } from 'lucide-react';
import { IssuesData, Gamification, Issue } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface IssuesTabProps {
  issues: IssuesData;
  gamification: Gamification;
}

interface IssueCardProps {
  issue: Issue;
  severity: 'high' | 'warning' | 'improvement';
  onAcknowledge?: () => void;
  onResolve?: () => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, severity, onAcknowledge, onResolve }) => {
  const getStatusBadge = () => {
    switch (issue.status) {
      case 'in-progress':
        return { bg: 'bg-success/15', color: 'text-success', icon: Clock, label: 'In Progress' };
      case 'dismissed':
        return { bg: 'bg-muted/15', color: 'text-muted-foreground', icon: XCircle, label: 'Dismissed' };
      case 'suggested':
        return { bg: 'bg-primary/15', color: 'text-primary', icon: Zap, label: 'Suggested' };
      default:
        return { bg: 'bg-destructive/15', color: 'text-destructive', icon: AlertCircle, label: 'Not Fixed' };
    }
  };

  const severityBorder = {
    high: 'border-l-destructive',
    warning: 'border-l-warning',
    improvement: 'border-l-info'
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div className={cn("glass rounded-xl p-5 border-l-[3px] transition-all duration-200 hover:shadow-card", severityBorder[severity])}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-foreground mb-2">{issue.title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{issue.impact}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground" />
              {issue.source}
            </span>
            {issue.affects && (
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                {issue.affects}
              </span>
            )}
            {issue.impactAmount && (
              <span className="flex items-center gap-1 font-medium text-destructive">
                {issue.impactAmount}
              </span>
            )}
          </div>
          {/* Action buttons */}
          {issue.status !== 'dismissed' && (
            <div className="flex gap-2">
              {issue.status !== 'in-progress' && onAcknowledge && (
                <button onClick={onAcknowledge} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
                  Acknowledge
                </button>
              )}
              {onResolve && (
                <button onClick={onResolve} className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors flex items-center gap-1">
                  <Check size={12} /> Mark Resolved
                </button>
              )}
            </div>
          )}
        </div>
        <span className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap", statusBadge.bg, statusBadge.color)}>
          <StatusIcon size={12} />
          {statusBadge.label}
        </span>
      </div>
    </div>
  );
};

export const IssuesTab: React.FC<IssuesTabProps> = ({ issues, gamification }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'date'>('severity');

  const filteredItems = issues.items.filter(item => {
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const criticalIssues = filteredItems.filter((i) => i.severity === 'high');
  const warningIssues = filteredItems.filter((i) => i.severity === 'warning');
  const improvements = filteredItems.filter((i) => i.severity === 'improvement');

  const getScoreColor = () => {
    if (gamification.totalScore >= 80) return 'from-success to-success/70';
    if (gamification.totalScore >= 60) return 'from-warning to-warning/70';
    return 'from-destructive to-destructive/70';
  };

  return (
    <div role="tabpanel" id="issues-panel" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <AlertCircle size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Issues & Quality</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Problems detected in your current setup</p>
        </div>
      </div>

      {/* Score Card */}
      <div className="glass rounded-2xl p-8 text-center">
        <div className="max-w-lg mx-auto">
          <div className="relative inline-block mb-4">
            <span className={cn("text-7xl font-bold bg-gradient-to-r bg-clip-text text-transparent", getScoreColor())}>
              {gamification.totalScore}
            </span>
            <span className="text-4xl text-muted-foreground font-bold">/100</span>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Overall Data Quality Score</h3>
          <div className="w-full max-w-md h-2.5 bg-secondary rounded-full overflow-hidden mx-auto my-5">
            <div className="h-full rounded-full bg-gradient-to-r from-destructive via-warning to-success transition-all duration-700"
              style={{ width: `${gamification.totalScore}%` }} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 size={14} className="text-success" />
            Last analyzed: {new Date(issues.lastAnalyzed).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <div className="flex gap-2">
          {['all', 'high', 'warning', 'improvement'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                severityFilter === s ? "gradient-primary text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}>
              {s === 'all' ? 'All' : s === 'high' ? 'Critical' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        <div className="flex gap-2">
          {['all', 'not-fixed', 'in-progress', 'dismissed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === s ? "gradient-primary text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}>
              {s === 'all' ? 'All Status' : s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Critical Issues ({criticalIssues.length})</h3>
          </div>
          <div className="space-y-3">
            {criticalIssues.map((issue, i) => (
              <IssueCard key={i} issue={issue} severity="high"
                onAcknowledge={() => {}} onResolve={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warningIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="text-lg font-semibold text-warning">Warnings ({warningIssues.length})</h3>
          </div>
          <div className="space-y-3">
            {warningIssues.map((issue, i) => (
              <IssueCard key={i} issue={issue} severity="warning"
                onAcknowledge={() => {}} onResolve={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Improvements */}
      {improvements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-info" />
            <h3 className="text-lg font-semibold text-info">Improvements ({improvements.length})</h3>
          </div>
          <div className="space-y-3">
            {improvements.map((issue, i) => (
              <IssueCard key={i} issue={issue} severity="improvement" />
            ))}
          </div>
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No issues found</h3>
          <p className="text-sm text-muted-foreground">No issues match your current filters.</p>
        </div>
      )}
    </div>
  );
};
