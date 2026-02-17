import React, { useState, useCallback } from 'react';
import { TabId, ViewMode, WidgetId, NewGoal } from '../../types/dashboard';
import { mockData } from '../../data/mockData';
import { Navigation } from './Navigation';
import { MappingModal, AddGoalModal } from './modals';
import { OverviewTab, IntelligenceTab, RevenueTab, OperationsTab, GoalsTab, IssuesTab, SuggestionsTab } from './tabs';

const DEFAULT_OVERVIEW_WIDGETS: WidgetId[] = ['metrics', 'aiInsights', 'revenueTrend'];

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
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
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMappingClick={() => setShowMappingModal(true)}
      />
      <main className="p-6 lg:p-8 max-w-[1800px] mx-auto animate-fade-in">
        {renderTabContent()}
      </main>
      <MappingModal isOpen={showMappingModal} onClose={() => setShowMappingModal(false)} dataMapping={mockData.dataMapping} />
      <AddGoalModal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} onSubmit={handleAddGoal} />
    </div>
  );
};

export default Dashboard;
