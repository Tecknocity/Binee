import React from 'react';
import { DollarSign, TrendingUp, Users, Briefcase, Target, Plus, LayoutGrid } from 'lucide-react';
import { MockData, WidgetId, ViewMode } from '../../../types/dashboard';
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
  onAddGoalClick: () => void;
  viewMode?: ViewMode;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, overviewWidgets, onAddGoalClick, viewMode = 'company' }) => {
  const pipelineData = viewMode === 'company' ? data.companyPipeline : data.pipeline;
  const dealCountData = viewMode === 'company' ? data.companyDealCount : data.pipeline;

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
    <div role="tabpanel" id="overview-panel" aria-labelledby="overview-tab" className="space-y-8">
      {/* Metrics Section */}
      {hasMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard title="Cash on Hand" value={`$${(data.metrics.cash / 1000).toFixed(1)}K`} subtitle="From QuickBooks" icon={DollarSign} color="success" topBorder="success" />
          <MetricCard title="Monthly Recurring Revenue" value={`$${(data.metrics.mrr / 1000).toFixed(0)}K`} subtitle="From Stripe" icon={TrendingUp} color="primary" topBorder="primary" />
          <MetricCard title="Active Customers" value={data.metrics.customers} subtitle="From HubSpot" icon={Users} color="info" topBorder="info" />
          <MetricCard title="Active Projects" value={data.metrics.projects} subtitle="From ClickUp" icon={Briefcase} color="accent" topBorder="accent" />
        </div>
      )}

      {/* AI Insights and Revenue Trend Row */}
      {(hasAiInsights || hasRevenueTrend) && (
        <div className={cn(
          "grid gap-5",
          hasAiInsights && hasRevenueTrend ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {hasAiInsights && <AIInsights predictions={data.predictions} />}
          {hasRevenueTrend && <RevenueTrend data={data.revenue} />}
        </div>
      )}

      {/* Revenue By Source and Expense Breakdown Row */}
      {(hasRevenueBySource || hasExpenseBreakdown) && (
        <div className={cn(
          "grid gap-5",
          hasRevenueBySource && hasExpenseBreakdown ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {hasRevenueBySource && <RevenueBySource data={data.revenueBySource} />}
          {hasExpenseBreakdown && <ExpenseBreakdown data={data.expenseBreakdown} />}
        </div>
      )}

      {/* Sales Pipeline and Deal Count Row */}
      {(hasSalesPipeline || hasDealCountByStage) && (
        <div className={cn(
          "grid gap-5",
          hasSalesPipeline && hasDealCountByStage ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {hasSalesPipeline && <SalesPipeline data={pipelineData} viewMode={viewMode} />}
          {hasDealCountByStage && <DealCountByStage data={dealCountData} viewMode={viewMode} />}
        </div>
      )}

      {hasHighValueDeals && <HighValueDeals deals={data.highValueDeals} />}
      {hasProjectHealth && <ProjectHealth projects={data.projects} />}

      {(hasTeamPerformance || hasTaskCompletionTrend) && (
        <div className={cn(
          "grid gap-5",
          hasTeamPerformance && hasTaskCompletionTrend ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}>
          {hasTeamPerformance && <TeamPerformance data={data.teamPerformance} />}
          {hasTaskCompletionTrend && <TaskCompletionTrend data={data.taskCompletionTrend} />}
        </div>
      )}

      {hasTeamCapacityUtilization && <TeamCapacityUtilization data={data.teamCapacityUtilization} />}

      {/* Empty State */}
      {!hasMetrics && !hasAnyWidgets && (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <LayoutGrid size={32} className="text-accent" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No Widgets Added
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Visit the Intelligence, Revenue, or Operations tabs and click the eye icon on any widget to add it to your Overview.
          </p>
        </div>
      )}

      {/* Goals Overview - Always shown */}
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
              <div 
                key={i} 
                className="bg-background/50 rounded-xl p-5 border border-border/50 transition-all duration-200 hover:border-accent/30"
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-base font-semibold text-foreground">{goal.name}</h4>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide",
                    isOnTrack ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  )}>
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
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isOnTrack ? "bg-success" : "bg-warning"
                    )}
                    style={{ width: `${Math.min(progress, 100)}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
