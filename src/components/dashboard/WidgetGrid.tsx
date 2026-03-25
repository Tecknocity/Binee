'use client';

import { useState, useMemo } from 'react';
import { MoreVertical, Trash2, GripVertical } from 'lucide-react';
import type { DashboardWidget } from '@/types/database';
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

// ---------------------------------------------------------------------------
// Widget skeleton loader
// ---------------------------------------------------------------------------

function WidgetSkeleton({ span }: { span: number }) {
  return (
    <div
      className={`rounded-2xl bg-surface border border-border overflow-hidden animate-pulse ${
        span === 3 ? 'col-span-1 md:col-span-2 lg:col-span-3' : span === 2 ? 'col-span-1 lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="h-4 w-32 bg-border/60 rounded" />
        <div className="h-4 w-4 bg-border/60 rounded" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-4 w-3/4 bg-border/40 rounded" />
        <div className="h-4 w-1/2 bg-border/40 rounded" />
        <div className="h-24 w-full bg-border/30 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single widget card
// ---------------------------------------------------------------------------

function WidgetCard({
  widget,
  onRemove,
}: {
  widget: DashboardWidget;
  onRemove: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function renderContent() {
    switch (widget.type) {
      case 'bar':
        return <BarChartWidget title={widget.title} config={widget.config} />;
      case 'line':
        return <LineChartWidget title={widget.title} config={widget.config} />;
      case 'summary':
        return <SummaryCardWidget title={widget.title} config={widget.config} />;
      case 'table':
        return <TableWidget title={widget.title} config={widget.config} />;
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

  // Determine column span from position.w (1-3)
  const colSpan = widget.position?.w ?? getDefaultSpan(widget.type);
  const spanClass =
    colSpan >= 3
      ? 'col-span-1 md:col-span-2 lg:col-span-3'
      : colSpan === 2
        ? 'col-span-1 lg:col-span-2'
        : '';

  const isSummary = widget.type === 'summary';

  return (
    <div
      className={`rounded-2xl bg-surface border border-border overflow-hidden transition-all hover:border-border-light ${spanClass}`}
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
            aria-label="Widget options"
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

// ---------------------------------------------------------------------------
// Default span by widget type
// ---------------------------------------------------------------------------

function getDefaultSpan(type: string): number {
  switch (type) {
    case 'summary':
      return 1;
    case 'bar':
    case 'line':
    case 'donut':
    case 'time_tracking':
    case 'workload':
    case 'priority':
      return 1;
    case 'table':
    case 'progress':
    case 'activity':
      return 3;
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Widget Grid
// ---------------------------------------------------------------------------

interface WidgetGridProps {
  widgets: DashboardWidget[];
  isLoading: boolean;
  onRemoveWidget: (id: string) => void;
}

export default function WidgetGrid({ widgets, isLoading, onRemoveWidget }: WidgetGridProps) {
  // Sort widgets by position (row first, then column)
  const sortedWidgets = useMemo(() => {
    return [...widgets].sort((a, b) => {
      const ay = a.position?.y ?? 0;
      const by = b.position?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = a.position?.x ?? 0;
      const bx = b.position?.x ?? 0;
      return ax - bx;
    });
  }, [widgets]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <WidgetSkeleton span={1} />
        <WidgetSkeleton span={1} />
        <WidgetSkeleton span={1} />
        <WidgetSkeleton span={2} />
        <WidgetSkeleton span={1} />
        <WidgetSkeleton span={3} />
      </div>
    );
  }

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedWidgets.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} onRemove={onRemoveWidget} />
      ))}
    </div>
  );
}
