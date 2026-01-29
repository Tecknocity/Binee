import React from 'react';
import { AlertCircle, AlertTriangle, Zap } from 'lucide-react';
import { IssuesData, Gamification, Issue } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface IssuesTabProps {
  issues: IssuesData;
  gamification: Gamification;
}

interface IssueCardProps {
  issue: Issue;
  borderColor: string;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, borderColor }) => {
  const getStatusBadge = () => {
    switch (issue.status) {
      case 'in-progress': return { bg: theme.colors.successLight, color: theme.colors.success, label: 'IN PROGRESS' };
      case 'dismissed': return { bg: theme.colors.mutedLight, color: theme.colors.muted, label: 'DISMISSED' };
      case 'suggested': return { bg: theme.colors.primaryLight, color: theme.colors.primary, label: 'SUGGESTED' };
      default: return { bg: theme.colors.dangerLight, color: theme.colors.danger, label: 'NOT FIXED' };
    }
  };
  const statusBadge = getStatusBadge();
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl, border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{issue.title}</h4>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>{issue.impact}</p>
          <div style={{ display: 'flex', gap: theme.spacing.lg, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
            <span>Source: {issue.source}</span>
            {issue.affects && <><span>•</span><span>Affects: {issue.affects}</span></>}
          </div>
        </div>
        <span style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, borderRadius: theme.borderRadius.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, background: statusBadge.bg, color: statusBadge.color, marginLeft: theme.spacing.lg, whiteSpace: 'nowrap' }}>{statusBadge.label}</span>
      </div>
    </div>
  );
};

export const IssuesTab: React.FC<IssuesTabProps> = ({ issues, gamification }) => {
  const criticalIssues = issues.items.filter((i) => i.severity === 'high');
  const warningIssues = issues.items.filter((i) => i.severity === 'warning');
  const improvements = issues.items.filter((i) => i.severity === 'improvement');

  return (
    <div role="tabpanel" id="issues-panel" aria-labelledby="issues-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <AlertCircle size={28} color={theme.colors.accent} />
        <div>
          <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Data Issues & Quality</h2>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Problems detected in your current setup</p>
        </div>
      </div>
      <div style={{ background: theme.colors.cardBg, padding: theme.spacing['3xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ fontSize: theme.fontSize['9xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.sm }}>{gamification.totalScore}<span style={{ fontSize: theme.fontSize['7xl'], color: theme.colors.textSecondary }}>/100</span></div>
          <h3 style={{ fontSize: theme.fontSize['3xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>Overall Data Quality Score</h3>
          <div style={{ width: '100%', maxWidth: '400px', height: '8px', background: theme.colors.progressBg, borderRadius: '4px', overflow: 'hidden', margin: `${theme.spacing['xl']} auto` }}>
            <div style={{ width: `${gamification.totalScore}%`, height: '100%', background: `linear-gradient(90deg, ${theme.colors.danger} 0%, ${theme.colors.warning} 50%, ${theme.colors.success} 100%)`, borderRadius: '4px' }} />
          </div>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Last analyzed: {new Date(issues.lastAnalyzed).toLocaleString()}</p>
        </div>
      </div>
      {criticalIssues.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <AlertCircle size={20} color={theme.colors.danger} />
            <h3 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.danger }}>Critical Issues ({criticalIssues.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
            {criticalIssues.map((issue, i) => <IssueCard key={i} issue={issue} borderColor={theme.colors.dangerBorder} />)}
          </div>
        </div>
      )}
      {warningIssues.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <AlertTriangle size={20} color={theme.colors.warning} />
            <h3 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.warning }}>Warnings ({warningIssues.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
            {warningIssues.map((issue, i) => <IssueCard key={i} issue={issue} borderColor={theme.colors.warningBorder} />)}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <Zap size={20} color={theme.colors.info} />
            <h3 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.info }}>Improvements ({improvements.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
            {improvements.map((issue, i) => <IssueCard key={i} issue={issue} borderColor={theme.colors.infoBorder} />)}
          </div>
        </div>
      )}
    </div>
  );
};
