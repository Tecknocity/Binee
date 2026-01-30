import React from 'react';
import { DollarSign, TrendingUp, Users, Briefcase, Target, Plus } from 'lucide-react';
import { MockData, WidgetId, ViewMode } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { MetricCard } from '../MetricCard';
import { AIInsights } from '../widgets/AIInsights';
import { RevenueTrend } from '../widgets/RevenueTrend';
import { RevenueBySource } from '../widgets/RevenueBySource';
import { ExpenseBreakdown } from '../widgets/ExpenseBreakdown';
import { SalesPipeline } from '../widgets/SalesPipeline';
import { DealCountByStage } from '../widgets/DealCountByStage';
import { HighValueDeals } from '../widgets/HighValueDeals';
import { ProjectHealth } from '../widgets/ProjectHealth';
import { TeamPerformance } from '../widgets/TeamPerformance';
import { TaskCompletionTrend } from '../widgets/TaskCompletionTrend';
import { TeamCapacityUtilization } from '../widgets/TeamCapacityUtilization';

interface OverviewTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onAddGoalClick: () => void;
  viewMode?: ViewMode;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, overviewWidgets, onAddGoalClick, viewMode = 'company' }) => {
  const pipelineData = viewMode === 'company' ? data.companyPipeline : data.pipeline;
  const dealCountData = viewMode === 'company' ? data.companyDealCount : data.pipeline;

  // Check if any widgets are in the overview
  const hasMetrics = overviewWidgets.includes('metrics');
  const hasAiInsights = overviewWidgets.includes('aiInsights');
  const hasRevenueTrend = overviewWidgets.includes('revenueTrend');
  const hasRevenueBySource = overviewWidgets.includes('revenueBySource');
  const hasExpenseBreakdown = overviewWidgets.includes('expenseBreakdown');
  const hasSalesPipeline = overviewWidgets.includes('salesPipeline');
  const hasDealCountByStage = overviewWidgets.includes('dealCountByStage');
  const hasHighValueDeals = overviewWidgets.includes('highValueDeals');
  const hasProjectHealth = overviewWidgets.includes('projectHealth');
  const hasTeamPerformance = overviewWidgets.includes('teamPerformance');
  const hasTaskCompletionTrend = overviewWidgets.includes('taskCompletionTrend');
  const hasTeamCapacityUtilization = overviewWidgets.includes('teamCapacityUtilization');

  // Check if we have any widgets at all (excluding metrics)
  const hasAnyWidgets = hasAiInsights || hasRevenueTrend || hasRevenueBySource || hasExpenseBreakdown ||
    hasSalesPipeline || hasDealCountByStage || hasHighValueDeals || hasProjectHealth ||
    hasTeamPerformance || hasTaskCompletionTrend || hasTeamCapacityUtilization;

  return (
    <div role="tabpanel" id="overview-panel" aria-labelledby="overview-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      {/* Metrics Section */}
      {hasMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing['xl'] }}>
          <MetricCard title="Cash on Hand" value={`$${(data.metrics.cash / 1000).toFixed(1)}K`} subtitle="From QuickBooks" icon={DollarSign} color={theme.colors.successLight} topBorder={theme.colors.success} />
          <MetricCard title="Monthly Recurring Revenue" value={`$${(data.metrics.mrr / 1000).toFixed(0)}K`} subtitle="From Stripe" icon={TrendingUp} color={theme.colors.primaryLight} topBorder={theme.colors.primary} />
          <MetricCard title="Active Customers" value={data.metrics.customers} subtitle="From HubSpot" icon={Users} color={theme.colors.infoLight} topBorder={theme.colors.info} />
          <MetricCard title="Active Projects" value={data.metrics.projects} subtitle="From ClickUp" icon={Briefcase} color={theme.colors.accentLight} topBorder={theme.colors.accent} />
        </div>
      )}

      {/* AI Insights and Revenue Trend Row */}
      {(hasAiInsights || hasRevenueTrend) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasAiInsights && hasRevenueTrend ? '1fr 1fr' : '1fr', gap: theme.spacing['xl'] }}>
          {hasAiInsights && <AIInsights predictions={data.predictions} />}
          {hasRevenueTrend && <RevenueTrend data={data.revenue} />}
        </div>
      )}

      {/* Revenue By Source and Expense Breakdown Row */}
      {(hasRevenueBySource || hasExpenseBreakdown) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasRevenueBySource && hasExpenseBreakdown ? '1fr 1fr' : '1fr', gap: theme.spacing['xl'] }}>
          {hasRevenueBySource && <RevenueBySource data={data.revenueBySource} />}
          {hasExpenseBreakdown && <ExpenseBreakdown data={data.expenseBreakdown} />}
        </div>
      )}

      {/* Sales Pipeline and Deal Count Row */}
      {(hasSalesPipeline || hasDealCountByStage) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasSalesPipeline && hasDealCountByStage ? '1fr 1fr' : '1fr', gap: theme.spacing['xl'] }}>
          {hasSalesPipeline && <SalesPipeline data={pipelineData} viewMode={viewMode} />}
          {hasDealCountByStage && <DealCountByStage data={dealCountData} viewMode={viewMode} />}
        </div>
      )}

      {/* High Value Deals */}
      {hasHighValueDeals && <HighValueDeals deals={data.highValueDeals} />}

      {/* Project Health */}
      {hasProjectHealth && <ProjectHealth projects={data.projects} />}

      {/* Team Performance and Task Completion Trend Row */}
      {(hasTeamPerformance || hasTaskCompletionTrend) && (
        <div style={{ display: 'grid', gridTemplateColumns: hasTeamPerformance && hasTaskCompletionTrend ? '1fr 1fr' : '1fr', gap: theme.spacing['xl'] }}>
          {hasTeamPerformance && <TeamPerformance data={data.teamPerformance} />}
          {hasTaskCompletionTrend && <TaskCompletionTrend data={data.taskCompletionTrend} />}
        </div>
      )}

      {/* Team Capacity Utilization */}
      {hasTeamCapacityUtilization && <TeamCapacityUtilization data={data.teamCapacityUtilization} />}

      {/* Empty State - when no widgets are selected */}
      {!hasMetrics && !hasAnyWidgets && (
        <div style={{
          background: theme.colors.cardBg,
          padding: theme.spacing['3xl'],
          borderRadius: theme.borderRadius['2xl'],
          border: theme.colors.cardBorder,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: theme.fontSize['6xl'],
            marginBottom: theme.spacing.lg
          }}>
            📊
          </div>
          <h3 style={{
            fontSize: theme.fontSize['2xl'],
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
            marginBottom: theme.spacing.md
          }}>
            No Widgets Added
          </h3>
          <p style={{
            fontSize: theme.fontSize.lg,
            color: theme.colors.textSecondary,
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            Visit the Intelligence, Revenue, or Operations tabs and click the eye icon on any widget to add it to your Overview.
          </p>
        </div>
      )}

      {/* Goals Overview - Always shown */}
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
