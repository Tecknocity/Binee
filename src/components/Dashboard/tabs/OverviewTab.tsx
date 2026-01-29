import React from 'react';
import { DollarSign, TrendingUp, Users, Briefcase, Target, Plus } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { MetricCard } from '../MetricCard';
import { AIInsights } from '../widgets/AIInsights';
import { RevenueTrend } from '../widgets/RevenueTrend';

interface OverviewTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onAddGoalClick: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, overviewWidgets, onAddGoalClick }) => {
  return (
    <div role="tabpanel" id="overview-panel" aria-labelledby="overview-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      {overviewWidgets.includes('metrics') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing['xl'] }}>
          <MetricCard title="Cash on Hand" value={`$${(data.metrics.cash / 1000).toFixed(1)}K`} subtitle="From QuickBooks" icon={DollarSign} color={theme.colors.successLight} topBorder={theme.colors.success} />
          <MetricCard title="Monthly Recurring Revenue" value={`$${(data.metrics.mrr / 1000).toFixed(0)}K`} subtitle="From Stripe" icon={TrendingUp} color={theme.colors.primaryLight} topBorder={theme.colors.primary} />
          <MetricCard title="Active Customers" value={data.metrics.customers} subtitle="From HubSpot" icon={Users} color={theme.colors.infoLight} topBorder={theme.colors.info} />
          <MetricCard title="Active Projects" value={data.metrics.projects} subtitle="From ClickUp" icon={Briefcase} color={theme.colors.accentLight} topBorder={theme.colors.accent} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing['xl'] }}>
        {overviewWidgets.includes('aiInsights') && <AIInsights predictions={data.predictions} />}
        {overviewWidgets.includes('revenueTrend') && <RevenueTrend data={data.revenue} />}
      </div>
      <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing['xl'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <Target size={24} color={theme.colors.accent} />
            <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Goals Overview</h3>
          </div>
          <button onClick={onAddGoalClick} style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, background: theme.colors.gradient, border: 'none', color: theme.colors.text, borderRadius: theme.borderRadius.lg, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <Plus size={16} /> Add Goal
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: theme.spacing['xl'] }}>
          {data.goals.map((goal, i) => {
            const progress = (goal.current / goal.target) * 100;
            const isOnTrack = goal.status === 'on-track';
            return (
              <div key={i} style={{ background: theme.colors.cardInner, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                  <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{goal.name}</h4>
                  <span style={{ padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, background: isOnTrack ? theme.colors.successLight : theme.colors.warningLight, color: isOnTrack ? theme.colors.success : theme.colors.warning }}>{isOnTrack ? 'ON-TRACK' : 'AT-RISK'}</span>
                </div>
                <div style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{goal.unit === 'USD' ? `$${(goal.current / 1000).toFixed(0)}K` : goal.current}<span style={{ fontSize: theme.fontSize.lg, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.normal }}> / {goal.unit === 'USD' ? `$${(goal.target / 1000).toFixed(0)}K` : goal.target}</span></div>
                <div style={{ width: '100%', height: '8px', background: theme.colors.progressBg, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: isOnTrack ? theme.colors.success : theme.colors.warning, borderRadius: '4px' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
