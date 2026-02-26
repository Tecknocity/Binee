import React from 'react';
import { DollarSign, TrendingUp, Users, Briefcase, Target, Plus, LayoutGrid, Link as LinkIcon, ArrowRight, Clock, AlertTriangle, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MockData, WidgetId } from '../../../types/dashboard';
import { WidgetWrapper } from '../WidgetWrapper';
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
import { cn } from '@/lib/utils';

interface OverviewTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
  onAddGoalClick: () => void;
}

const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-destructive';
  const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle cx="80" cy="80" r="70" fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-bold", color)}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
    </div>
  );
};

const QUICK_ACTIONS = [
  { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', title: '3 deals stale for 15+ days', action: 'Review pipeline', tab: 'growth' },
  { icon: TrendingUp, color: 'text-destructive', bg: 'bg-destructive/10', title: 'Churn rate up 2% this month', action: 'Check at-risk customers', tab: 'insights' },
  { icon: Activity, color: 'text-info', bg: 'bg-info/10', title: '8 tasks overdue by 7+ days', action: 'Review operations', tab: 'operations' },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, overviewWidgets, onToggleWidget, onAddGoalClick }) => {
  const pipelineData = data.pipeline;
  const dealCountData = data.pipeline;

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

  const hasAnyWidgets = hasAiInsights || hasRevenueTrend || hasRevenueBySource || hasExpenseBreakdown ||
    hasSalesPipeline || hasDealCountByStage || hasHighValueDeals || hasProjectHealth ||
    hasTeamPerformance || hasTaskCompletionTrend || hasTeamCapacityUtilization;

  return (
    <div role="tabpanel" id="overview-panel" className="space-y-8">
      {/* Business Health Score */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <HealthGauge score={82} />
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-semibold text-foreground mb-2">Business Health Score</h3>
            <p className="text-muted-foreground mb-4">
              Your business is healthy but pipeline coverage needs attention. Revenue growth is strong at 12.5% MoM.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={12} />
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => (
          <div key={i} className="glass rounded-xl p-4 card-hover cursor-pointer group">
            <div className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", action.bg)}>
                <action.icon size={18} className={action.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{action.title}</p>
                <p className="text-xs text-accent mt-1 flex items-center gap-1 group-hover:underline">
                  {action.action} <ArrowRight size={10} />
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Metrics Section */}
      {hasMetrics && (
        <WidgetWrapper widgetId="metrics" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <div className="glass rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard title="Cash on Hand" value={`$${(data.metrics.cash / 1000).toFixed(1)}K`} subtitle="From QuickBooks" icon={DollarSign} color="success" topBorder="success" />
              <MetricCard title="Monthly Recurring Revenue" value={`$${(data.metrics.mrr / 1000).toFixed(0)}K`} subtitle="From Stripe" icon={TrendingUp} color="primary" topBorder="primary" />
              <MetricCard title="Active Customers" value={data.metrics.customers} subtitle="From HubSpot" icon={Users} color="info" topBorder="info" />
              <MetricCard title="Active Projects" value={data.metrics.projects} subtitle="From ClickUp" icon={Briefcase} color="accent" topBorder="accent" />
            </div>
          </div>
        </WidgetWrapper>
      )}

      {/* AI Insights and Revenue Trend */}
      {(hasAiInsights || hasRevenueTrend) && (
        <div className={cn("grid gap-5", hasAiInsights && hasRevenueTrend ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {hasAiInsights && (
            <WidgetWrapper widgetId="aiInsights" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <AIInsights predictions={data.predictions} />
            </WidgetWrapper>
          )}
          {hasRevenueTrend && (
            <WidgetWrapper widgetId="revenueTrend" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <RevenueTrend data={data.revenue} />
            </WidgetWrapper>
          )}
        </div>
      )}

      {(hasRevenueBySource || hasExpenseBreakdown) && (
        <div className={cn("grid gap-5", hasRevenueBySource && hasExpenseBreakdown ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {hasRevenueBySource && (
            <WidgetWrapper widgetId="revenueBySource" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <RevenueBySource data={data.revenueBySource} />
            </WidgetWrapper>
          )}
          {hasExpenseBreakdown && (
            <WidgetWrapper widgetId="expenseBreakdown" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <ExpenseBreakdown data={data.expenseBreakdown} />
            </WidgetWrapper>
          )}
        </div>
      )}

      {(hasSalesPipeline || hasDealCountByStage) && (
        <div className={cn("grid gap-5", hasSalesPipeline && hasDealCountByStage ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {hasSalesPipeline && (
            <WidgetWrapper widgetId="salesPipeline" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <SalesPipeline data={pipelineData} />
            </WidgetWrapper>
          )}
          {hasDealCountByStage && (
            <WidgetWrapper widgetId="dealCountByStage" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <DealCountByStage data={dealCountData} />
            </WidgetWrapper>
          )}
        </div>
      )}

      {hasHighValueDeals && (
        <WidgetWrapper widgetId="highValueDeals" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <HighValueDeals deals={data.highValueDeals} />
        </WidgetWrapper>
      )}
      {hasProjectHealth && (
        <WidgetWrapper widgetId="projectHealth" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <ProjectHealth projects={data.projects} />
        </WidgetWrapper>
      )}

      {(hasTeamPerformance || hasTaskCompletionTrend) && (
        <div className={cn("grid gap-5", hasTeamPerformance && hasTaskCompletionTrend ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {hasTeamPerformance && (
            <WidgetWrapper widgetId="teamPerformance" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <TeamPerformance data={data.teamPerformance} />
            </WidgetWrapper>
          )}
          {hasTaskCompletionTrend && (
            <WidgetWrapper widgetId="taskCompletionTrend" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
              <TaskCompletionTrend data={data.taskCompletionTrend} />
            </WidgetWrapper>
          )}
        </div>
      )}

      {hasTeamCapacityUtilization && (
        <WidgetWrapper widgetId="teamCapacityUtilization" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <TeamCapacityUtilization data={data.teamCapacityUtilization} />
        </WidgetWrapper>
      )}

      {/* Empty State */}
      {!hasMetrics && !hasAnyWidgets && (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <LinkIcon size={32} className="text-accent" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Connect your first tool</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Connect your business tools to see your business health score and insights.
          </p>
          <Link to="/integrations" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            Connect Integrations <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* Goals Overview */}
      <div className="glass rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Target size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Goals Overview</h3>
              <p className="text-xs text-muted-foreground">Track your business objectives</p>
            </div>
          </div>
          <button
            onClick={onAddGoalClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold transition-all duration-200 hover:shadow-glow hover:opacity-90"
          >
            <Plus size={16} /> Add Goal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.goals.map((goal, i) => {
            const progress = (goal.current / goal.target) * 100;
            const isOnTrack = goal.status === 'on-track';
            return (
              <div key={i} className="bg-background/50 rounded-xl p-5 border border-border/50 transition-all duration-200 hover:border-accent/30">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-base font-semibold text-foreground">{goal.name}</h4>
                  <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide", isOnTrack ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {isOnTrack ? 'On Track' : 'At Risk'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-foreground">
                    {goal.unit === 'USD' ? `$${(goal.current / 1000).toFixed(0)}K` : goal.current}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {goal.unit === 'USD' ? `$${(goal.target / 1000).toFixed(0)}K` : goal.target}
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", isOnTrack ? "bg-success" : "bg-warning")}
                    style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
