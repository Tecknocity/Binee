import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Clock, Filter, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { IntegrationHealthData, IntegrationHealthIssue } from '../../../types/dashboard';
import { cn } from '@/lib/utils';
import { mockIntegrations } from '@/data/mock/integrations';

interface IssuesTabProps {
  integrationHealth: IntegrationHealthData;
}

interface IssueCardProps {
  issue: IntegrationHealthIssue;
  onAcknowledge?: () => void;
  onResolve?: () => void;
}

const SEVERITY_CONFIG = {
  critical: { border: 'border-l-destructive', icon: AlertCircle, iconColor: 'text-destructive', label: 'Critical' },
  warning: { border: 'border-l-warning', icon: AlertTriangle, iconColor: 'text-warning', label: 'Warning' },
  info: { border: 'border-l-info', icon: Info, iconColor: 'text-info', label: 'Info' },
};

const STATUS_CONFIG = {
  active: { bg: 'bg-destructive/15', color: 'text-destructive', icon: AlertCircle, label: 'Active' },
  acknowledged: { bg: 'bg-warning/15', color: 'text-warning', icon: Clock, label: 'Acknowledged' },
  resolved: { bg: 'bg-success/15', color: 'text-success', icon: CheckCircle2, label: 'Resolved' },
};

const TYPE_LABELS: Record<string, string> = {
  auth_error: 'Authentication',
  rate_limit: 'Rate Limit',
  sync_failure: 'Sync Failure',
  permission_error: 'Permissions',
  api_error: 'API Error',
  connection_lost: 'Connection Lost',
  config_warning: 'Configuration',
};

const IssueCard: React.FC<IssueCardProps> = ({ issue, onAcknowledge, onResolve }) => {
  const severity = SEVERITY_CONFIG[issue.severity];
  const status = STATUS_CONFIG[issue.status];
  const StatusIcon = status.icon;

  return (
    <div className={cn("glass rounded-xl p-5 border-l-[3px] transition-all duration-200 hover:shadow-card", severity.border)}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{issue.integrationName}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[issue.type] || issue.type}</span>
          </div>
          <h4 className="text-base font-semibold text-foreground mb-2">{issue.title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{issue.description}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            {issue.errorCode && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/50 font-mono">
                {issue.errorCode}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {new Date(issue.occurredAt).toLocaleString()}
            </span>
          </div>
          {issue.resolution && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 mb-3">
              <span className="font-medium text-foreground">Resolution: </span>{issue.resolution}
            </div>
          )}
          {issue.status !== 'resolved' && (
            <div className="flex gap-2">
              {issue.status === 'active' && onAcknowledge && (
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
        <span className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap", status.bg, status.color)}>
          <StatusIcon size={12} />
          {status.label}
        </span>
      </div>
    </div>
  );
};

export const IssuesTab: React.FC<IssuesTabProps> = ({ integrationHealth }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const connectedIntegrations = mockIntegrations.filter(i => i.isConnected);

  const filteredIssues = integrationHealth.issues.filter(issue => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    return true;
  });

  const criticalIssues = filteredIssues.filter(i => i.severity === 'critical');
  const warningIssues = filteredIssues.filter(i => i.severity === 'warning');
  const infoIssues = filteredIssues.filter(i => i.severity === 'info');

  const activeIssueCount = integrationHealth.issues.filter(i => i.status === 'active').length;
  const criticalCount = integrationHealth.issues.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;

  // Build per-integration status from issues
  const integrationStatuses = connectedIntegrations.map(integration => {
    const issues = integrationHealth.issues.filter(i => i.integrationSlug === integration.slug && i.status !== 'resolved');
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasWarning = issues.some(i => i.severity === 'warning');
    const status = hasCritical ? 'error' : hasWarning ? 'degraded' : 'healthy';
    return { ...integration, healthStatus: status, issueCount: issues.length };
  });

  return (
    <div role="tabpanel" id="issues-panel" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Wifi size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Integration Health</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor connection status and resolve integration errors</p>
        </div>
      </div>

      {/* Connection Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {integrationStatuses.map(integration => (
          <div key={integration.slug} className={cn(
            "glass rounded-xl p-4 border transition-all duration-200",
            integration.healthStatus === 'error' ? 'border-destructive/30' :
            integration.healthStatus === 'degraded' ? 'border-warning/30' :
            'border-success/30'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{integration.name}</span>
              {integration.healthStatus === 'healthy' ? (
                <span className="flex items-center gap-1 text-xs text-success font-medium">
                  <CheckCircle2 size={13} /> Healthy
                </span>
              ) : integration.healthStatus === 'error' ? (
                <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                  <WifiOff size={13} /> Error
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-warning font-medium">
                  <AlertTriangle size={13} /> Degraded
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last sync: {integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
              {integration.issueCount > 0 && (
                <span className="font-medium">{integration.issueCount} issue{integration.issueCount > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary bar */}
      {activeIssueCount > 0 && (
        <div className={cn(
          "glass rounded-xl p-4 flex items-center gap-3",
          criticalCount > 0 ? 'border border-destructive/30' : 'border border-warning/30'
        )}>
          {criticalCount > 0 ? (
            <AlertCircle size={18} className="text-destructive flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-warning flex-shrink-0" />
          )}
          <p className="text-sm text-foreground">
            <span className="font-semibold">{activeIssueCount} active issue{activeIssueCount > 1 ? 's' : ''}</span>
            {criticalCount > 0 && (
              <span className="text-destructive"> ({criticalCount} critical)</span>
            )}
            <span className="text-muted-foreground"> requiring attention</span>
          </p>
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw size={11} />
            Checked {new Date(integrationHealth.lastChecked).toLocaleString()}
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <div className="flex gap-2">
          {['all', 'critical', 'warning', 'info'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                severityFilter === s ? "gradient-primary text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        <div className="flex gap-2">
          {['all', 'active', 'acknowledged', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === s ? "gradient-primary text-white" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Critical ({criticalIssues.length})</h3>
          </div>
          <div className="space-y-3">
            {criticalIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue}
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
            {warningIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue}
                onAcknowledge={() => {}} onResolve={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      {infoIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-info" />
            <h3 className="text-lg font-semibold text-info">Info ({infoIssues.length})</h3>
          </div>
          <div className="space-y-3">
            {infoIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {filteredIssues.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">All integrations healthy</h3>
          <p className="text-sm text-muted-foreground">No issues match your current filters. All connections are operating normally.</p>
        </div>
      )}
    </div>
  );
};
