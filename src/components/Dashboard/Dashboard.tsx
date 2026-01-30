import React, { useState, useCallback } from 'react';
import { TabId, ViewMode, WidgetId, NewGoal } from '../../types/dashboard';
import { mockData } from '../../data/mockData';
import { theme } from '../../styles/theme';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { SettingsModal, MappingModal, AddGoalModal } from './modals';
import { OverviewTab, IntelligenceTab, RevenueTab, OperationsTab, GoalsTab, IssuesTab, SuggestionsTab } from './tabs';

const DEFAULT_OVERVIEW_WIDGETS: WidgetId[] = ['metrics', 'aiInsights', 'revenueTrend'];

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('company');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [overviewWidgets, setOverviewWidgets] = useState<WidgetId[]>(DEFAULT_OVERVIEW_WIDGETS);

  const handleToggleWidget = useCallback((widgetId: WidgetId) => {
    setOverviewWidgets((prev) =>
      prev.includes(widgetId) ? prev.filter((id) => id !== widgetId) : [...prev, widgetId]
    );
  }, []);

  const handleRefreshData = useCallback(() => {
    alert('Refreshing data from all connected tools and API connections...');
  }, []);

  const handleLogout = useCallback(() => {
    alert('Logging out...');
  }, []);

  const handleAddGoal = useCallback((goal: NewGoal) => {
    console.log('New goal:', goal);
    alert(`Goal created: ${goal.name}`);
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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, color: theme.colors.text, fontFamily: 'system-ui, sans-serif' }}>
      <Header
        viewMode={viewMode}
        showAccountMenu={showAccountMenu}
        onViewModeChange={setViewMode}
        onAccountMenuToggle={setShowAccountMenu}
        onSettingsClick={() => setShowSettingsModal(true)}
        onMappingClick={() => setShowMappingModal(true)}
        onRefreshClick={handleRefreshData}
        onLogout={handleLogout}
      />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ padding: theme.spacing['3xl'] }}>{renderTabContent()}</main>
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      <MappingModal isOpen={showMappingModal} onClose={() => setShowMappingModal(false)} dataMapping={mockData.dataMapping} />
      <AddGoalModal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} onSubmit={handleAddGoal} />
    </div>
  );
};

export default Dashboard;
