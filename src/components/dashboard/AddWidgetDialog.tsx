'use client';

import { useState } from 'react';
import { X, BarChart3, LineChart as LineChartIcon, Hash, Table } from 'lucide-react';

interface AddWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (config: {
    type: string;
    title: string;
    config: Record<string, unknown>;
  }) => void;
}

const widgetTypes = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3, desc: 'Compare values across categories' },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon, desc: 'Show trends over time' },
  { value: 'summary', label: 'Summary Card', icon: Hash, desc: 'Display a single key metric' },
  { value: 'table', label: 'Data Table', icon: Table, desc: 'Show detailed data rows' },
];

const dataSources = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'time_entries', label: 'Time Entries' },
];

const metrics = [
  { value: 'count', label: 'Count' },
  { value: 'hours', label: 'Hours' },
];

const groupByOptions = [
  { value: 'assignee', label: 'Assignee' },
  { value: 'status', label: 'Status' },
  { value: 'list', label: 'List' },
  { value: 'week', label: 'Week' },
];

const timeRanges = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export default function AddWidgetDialog({ open, onClose, onAdd }: AddWidgetDialogProps) {
  const [widgetType, setWidgetType] = useState('bar');
  const [title, setTitle] = useState('');
  const [dataSource, setDataSource] = useState('tasks');
  const [metric, setMetric] = useState('count');
  const [groupBy, setGroupBy] = useState('assignee');
  const [timeRange, setTimeRange] = useState('30d');

  if (!open) return null;

  function handleSave() {
    const finalTitle =
      title.trim() ||
      `${dataSources.find((d) => d.value === dataSource)?.label} by ${groupByOptions.find((g) => g.value === groupBy)?.label}`;

    onAdd({
      type: widgetType,
      title: finalTitle,
      config: {
        dataSource,
        metric,
        groupBy,
        timeRange,
      },
    });

    // Reset
    setWidgetType('bar');
    setTitle('');
    setDataSource('tasks');
    setMetric('count');
    setGroupBy('assignee');
    setTimeRange('30d');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-navy-light border border-border shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Add Widget</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Widget Type */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2.5 block">
              Widget Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {widgetTypes.map((t) => {
                const Icon = t.icon;
                const selected = widgetType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setWidgetType(t.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${selected ? 'text-accent' : 'text-text-muted'}`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          selected ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {t.label}
                      </p>
                      <p className="text-xs text-text-muted">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-1.5 block">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated if empty..."
              className="w-full bg-navy-base border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Data Source + Metric */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">
                Data Source
              </label>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full bg-navy-base border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
              >
                {dataSources.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">
                Metric
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full bg-navy-base border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
              >
                {metrics.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Group By + Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full bg-navy-base border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
              >
                {groupByOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full bg-navy-base border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
              >
                {timeRanges.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview hint */}
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Preview</p>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              {(() => {
                const Icon = widgetTypes.find((t) => t.value === widgetType)?.icon ?? BarChart3;
                return <Icon className="w-4 h-4 text-accent" />;
              })()}
              <span>
                {title || 'Widget'} &mdash;{' '}
                {dataSources.find((d) => d.value === dataSource)?.label}{' '}
                {metrics.find((m) => m.value === metric)?.label} by{' '}
                {groupByOptions.find((g) => g.value === groupBy)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Add Widget
          </button>
        </div>
      </div>
    </div>
  );
}
