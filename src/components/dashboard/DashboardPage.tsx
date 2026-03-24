'use client';

import { useState, useCallback } from 'react';
import { Plus, LayoutDashboard, Sparkles, Save } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import DashboardSelector from './DashboardSelector';
import AddWidgetDialog from './AddWidgetDialog';
import DashboardChatPanel from './DashboardChatPanel';
import WidgetGrid from './WidgetGrid';

export default function DashboardPage() {
  const {
    dashboards,
    activeDashboard,
    widgets,
    isLoading,
    isSaving,
    setActiveDashboard,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    duplicateDashboard,
    saveLayout,
    addWidget,
    removeWidget,
    refreshDashboards,
  } = useDashboard();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const handleDashboardUpdated = useCallback(() => {
    refreshDashboards();
  }, [refreshDashboards]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboards</h1>
          <p className="text-sm text-text-secondary mt-1">Track your workspace metrics and performance</p>
        </div>
        <div className="flex items-center gap-2">
          {widgets.length > 0 && (
            <button
              onClick={saveLayout}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-accent/40 hover:bg-surface-hover text-text-secondary hover:text-text-primary text-sm font-medium transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Layout'}
            </button>
          )}
          <button
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-accent/40 hover:bg-surface-hover text-text-secondary hover:text-text-primary text-sm font-medium transition-all group"
          >
            <Sparkles className="w-4 h-4 text-accent group-hover:text-accent" />
            Build with AI
          </button>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Widget
          </button>
        </div>
      </div>

      {/* Dashboard selector */}
      <div className="flex items-center gap-4 mb-6">
        <DashboardSelector
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          onSelect={setActiveDashboard}
          onCreate={createDashboard}
          onRename={renameDashboard}
          onDuplicate={duplicateDashboard}
          onDelete={deleteDashboard}
        />
        {activeDashboard?.description && (
          <span className="text-sm text-text-muted hidden md:block">
            {activeDashboard.description}
          </span>
        )}
      </div>

      {/* Widget grid */}
      <WidgetGrid
        widgets={widgets}
        isLoading={isLoading}
        onRemoveWidget={removeWidget}
      />

      {/* Empty state — only when loaded and no widgets */}
      {!isLoading && widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
            <LayoutDashboard className="w-7 h-7 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Build your dashboard</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-sm">
            Add widgets to visualize your workspace data with charts, metrics, and tables. Start by adding your first widget or let AI build it for you.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAiPanelOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-accent/30 hover:bg-surface-hover text-text-primary text-sm font-medium transition-all group"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              Build with AI
            </button>
            <button
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Widget Manually
            </button>
          </div>
        </div>
      )}

      <AddWidgetDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={(config) => {
          addWidget({
            type: config.type,
            title: config.title,
            config: config.config,
          });
        }}
      />

      {/* AI Chat Side Panel */}
      <DashboardChatPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        dashboardId={activeDashboard?.id ?? ''}
        dashboardName={activeDashboard?.name ?? 'My Dashboard'}
        onDashboardUpdated={handleDashboardUpdated}
      />
    </div>
  );
}
