import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabId, WidgetId, NewGoal } from '../../types/dashboard';
import { mockData } from '../../data/mockData';
import { AddGoalModal } from './modals';
import { OverviewTab, IntelligenceTab, RevenueTab, OperationsTab, SuggestionsTab, GoalsTab } from './tabs';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useAppearance } from '@/contexts/AppearanceContext';
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
  const { defaultTab } = useAppearance();
  const activeTab = (searchParams.get('tab') as TabId) || (defaultTab as TabId) || 'home';
  const { viewMode } = useViewMode();
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
      case 'home':
        return <OverviewTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} onAddGoalClick={() => setShowAddGoalModal(true)} viewMode={viewMode} />;
      case 'goals':
        return <GoalsTab goals={mockData.goals} onAddGoalClick={() => setShowAddGoalModal(true)} />;
      case 'growth':
        return <RevenueTab data={mockData} viewMode={viewMode} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'operations':
        return <OperationsTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'insights':
        return <IntelligenceTab data={mockData} overviewWidgets={overviewWidgets} onToggleWidget={handleToggleWidget} />;
      case 'actions':
        return <SuggestionsTab suggestions={mockData.suggestions} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <main className="p-6 lg:p-8 max-w-[1800px] mx-auto animate-fade-in">
        {renderTabContent()}
      </main>
      <AddGoalModal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} onSubmit={handleAddGoal} />
    </div>
  );
};

export default Dashboard;
