import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabId, ViewMode, WidgetId, NewGoal } from '../../types/dashboard';
import { mockData } from '../../data/mockData';
import { MappingModal, AddGoalModal } from './modals';
import { OverviewTab, IntelligenceTab, RevenueTab, OperationsTab, GoalsTab, IssuesTab, SuggestionsTab } from './tabs';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_OVERVIEW_WIDGETS: WidgetId[] = ['metrics', 'aiInsights', 'revenueTrend'];

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'overview';
  const [viewMode, setViewMode] = useState<ViewMode>('company');
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [overviewWidgets, setOverviewWidgets] = useState<WidgetId[]>(DEFAULT_OVERVIEW_WIDGETS);

  const handleToggleWidget = useCallback((widgetId: WidgetId) => {
    setOverviewWidgets((prev) =>
      prev.includes(widgetId) ? prev.filter((id) => id !== widgetId) : [...prev, widgetId]
    );
  }, []);

  const handleAddGoal = useCallback((goal: NewGoal) => {
    console.log('New goal:', goal);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={mockData} overviewWidgets={overviewWidgets} onAddGoalClick={() => setShowAddGoalModal(true)} viewMode={viewMode} />;
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
      <div className="flex items-center justify-between px-6 lg:px-8 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMappingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-xs font-medium"
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
