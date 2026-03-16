'use client';

import { useState, useCallback } from 'react';
import { Plus, MoreVertical, Trash2, GripVertical, LayoutDashboard, Sparkles } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import DashboardSelector from './DashboardSelector';
import AddWidgetDialog from './AddWidgetDialog';
import DashboardChatPanel from './DashboardChatPanel';
import BarChartWidget from './widgets/BarChartWidget';
import LineChartWidget from './widgets/LineChartWidget';
import SummaryCardWidget from './widgets/SummaryCardWidget';
import TableWidget from './widgets/TableWidget';
import DonutChartWidget from './widgets/DonutChartWidget';
import TimeTrackingWidget from './widgets/TimeTrackingWidget';
import WorkloadWidget from './widgets/WorkloadWidget';
import PriorityBreakdownWidget from './widgets/PriorityBreakdownWidget';
import ProgressWidget from './widgets/ProgressWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';

function WidgetCard({
  widget,
  onRemove,
}: {
  widget: { id: string; type: string; title: string; config: Record<string, unknown> };
  onRemove: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function renderContent() {
    switch (widget.type) {
      case 'bar':
        return <BarChartWidget title={widget.title} />;
      case 'line':
        return <LineChartWidget title={widget.title} />;
      case 'summary':
        return <SummaryCardWidget title={widget.title} config={widget.config} />;
      case 'table':
        return <TableWidget title={widget.title} />;
      case 'donut':
        return <DonutChartWidget title={widget.title} />;
      case 'time_tracking':
        return <TimeTrackingWidget title={widget.title} />;
      case 'workload':
        return <WorkloadWidget title={widget.title} />;
      case 'priority':
        return <PriorityBreakdownWidget title={widget.title} />;
      case 'progress':
        return <ProgressWidget title={widget.title} />;
      case 'activity':
        return <RecentActivityWidget title={widget.title} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Unknown widget type
          </div>
        );
    }
  }

  const isSummary = widget.type === 'summary';

  return (
    <div
      className={`rounded-2xl bg-surface border border-border overflow-hidden transition-all hover:border-border-light ${
        widget.type === 'table' ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''
      } ${
        widget.type === 'bar' || widget.type === 'line'
          ? 'col-span-1 md:col-span-1 lg:col-span-1'
          : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-text-muted/40 cursor-grab" />
          <h3 className="text-sm font-medium text-text-primary">{widget.title}</h3>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-navy-light border border-border shadow-xl z-50 py-1">
                <button
                  onClick={() => {
                    onRemove(widget.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-surface-hover transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={isSummary ? 'px-5 py-5' : 'p-5'}>{renderContent()}</div>
    </div>
  );
}

export default function DashboardPage() {
  const {
    dashboards,
    activeDashboard,
    widgets,
    setActiveDashboard,
    createDashboard,
    addWidget,
    removeWidget,
  } = useDashboard();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Split widgets into summary vs charts/tables for layout
  const summaryWidgets = widgets.filter((w) => w.type === 'summary');
  const chartWidgets = widgets.filter(
    (w) => w.type === 'bar' || w.type === 'line' || w.type === 'donut' || w.type === 'time_tracking' || w.type === 'priority' || w.type === 'workload'
  );
  const tableWidgets = widgets.filter((w) => w.type === 'table');
  const fullWidthWidgets = widgets.filter(
    (w) => w.type === 'progress' || w.type === 'activity'
  );

  const handleDashboardUpdated = useCallback(() => {
    // In production, this would refetch dashboard data from Supabase.
    // For now with mock data, this is a placeholder for the refresh mechanism.
    // The panel notifies us when widgets are created/updated/deleted via AI.
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboards</h1>
          <p className="text-sm text-text-secondary mt-1">Track your workspace metrics and performance</p>
        </div>
        <div className="flex items-center gap-2">
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
        />
        {activeDashboard?.description && (
          <span className="text-sm text-text-muted hidden md:block">
            {activeDashboard.description}
          </span>
        )}
      </div>

      {/* Summary cards row */}
      {summaryWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaryWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onRemove={removeWidget} />
          ))}
        </div>
      )}

      {/* Charts row */}
      {chartWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {chartWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onRemove={removeWidget} />
          ))}
        </div>
      )}

      {/* Table widgets */}
      {tableWidgets.length > 0 && (
        <div className="space-y-4 mb-6">
          {tableWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onRemove={removeWidget} />
          ))}
        </div>
      )}

      {/* Full-width widgets (progress, activity) */}
      {fullWidthWidgets.length > 0 && (
        <div className="space-y-4 mb-6">
          {fullWidthWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onRemove={removeWidget} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {widgets.length === 0 && (
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
