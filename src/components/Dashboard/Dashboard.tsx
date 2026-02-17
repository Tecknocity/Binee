import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabId, ViewMode, WidgetId, NewGoal } from '../../types/dashboard';
import { mockData } from '../../data/mockData';
import { MappingModal, AddGoalModal } from './modals';
import { OverviewTab, IntelligenceTab, RevenueTab, OperationsTab, GoalsTab, IssuesTab, SuggestionsTab } from './tabs';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEFAULT_OVERVIEW_WIDGETS: WidgetId[] = ['metrics', 'aiInsights', 'revenueTrend'];
const OVERVIEW_WIDGETS_KEY = 'binee-overview-widgets';

const WIDGET_LABELS: Record<WidgetId, string> = {
  metrics: 'Metrics',
  aiInsights: 'AI Insights',
  revenueTrend: 'Revenue Trend',
  revenueBySource: 'Revenue by Source',
  expenseBreakdown: 'Expense Breakdown',
  salesPipeline: 'Sales Pipeline',
  dealCountByStage: 'Deal Count by Stage',
  highValueDeals: 'High Value Deals',
  projectHealth: 'Project Health',
  teamPerformance: 'Team Performance',
  taskCompletionTrend: 'Task Completion Trend',
  teamCapacityUtilization: 'Team Capacity Utilization',
};

function loadOverviewWidgets(): WidgetId[] {
  try {
    const stored = localStorage.getItem(OVERVIEW_WIDGETS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load overview widgets from localStorage:', e);
  }
  return DEFAULT_OVERVIEW_WIDGETS;
}

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'overview';
  const [viewMode, setViewMode] = useState<ViewMode>('company');
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [overviewWidgets, setOverviewWidgets] = useState<WidgetId[]>(loadOverviewWidgets);

  useEffect(() => {
    try {
      localStorage.setItem(OVERVIEW_WIDGETS_KEY, JSON.stringify(overviewWidgets));
    } catch (e) {
      console.error('Failed to save overview widgets:', e);
    }
  }, [overviewWidgets]);

  const handleToggleWidget = useCallback((widgetId: WidgetId) => {
    setOverviewWidgets((prev) => {
      const isRemoving = prev.includes(widgetId);
      const next = isRemoving ? prev.filter((id) => id !== widgetId) : [...prev, widgetId];
      const label = WIDGET_LABELS[widgetId] || widgetId;
      toast(isRemoving ? `Removed "${label}" from Overview` : `Added "${label}" to Overview`);
      return next;
    });
  }, []);

  const handleAddGoal = useCallback((goal: NewGoal) => {
    console.log('New goal:', goal);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} onAddGoalClick={() => setShowAddGoalModal(true)} viewMode={viewMode} />;
      case 'intelligence':
        return <IntelligenceTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'revenue':
        return <RevenueTab data={mockData} viewMode={viewMode} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'operations':
        return <OperationsTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'goals':
        return <GoalsTab goals={mockData.goals} onAddGoalClick={() => setShowAddGoalModal(true)} />;
      case 'issues':
        return <IssuesTab issues={mockData.issues} gamification={mockData.gamification} />;
      case 'suggestions':
        return <SuggestionsTab suggestions={mockData.suggestions} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-3 border-b border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMappingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-xs font-medium"
          >
            <Database size={13} />
            Mapping
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('company')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === 'company'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Company
            </button>
            <button
              onClick={() => setViewMode('binee')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === 'binee'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Binee
            </button>
          </div>
        </div>
      </div>

      <main className="p-6 lg:p-8 max-w-[1800px] mx-auto animate-fade-in">
        {renderTabContent()}
      </main>
      <MappingModal isOpen={showMappingModal} onClose={() => setShowMappingModal(false)} dataMapping={mockData.dataMapping} />
      <AddGoalModal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} onSubmit={handleAddGoal} />
    </div>
  );
};

export default Dashboard;
