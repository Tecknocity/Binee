'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useOverdueTasksData } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

interface ColumnDefinition {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'priority' | 'date' | 'badge';
  width?: string;
  badgeColors?: Record<string, string>;
}

interface TableWidgetConfig {
  data?: Array<Record<string, unknown>>;
  columns?: ColumnDefinition[];
  sortable?: boolean;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  emptyMessage?: string;
  maxRows?: number;
}

const defaultPriorityColors: Record<string, string> = {
  urgent: 'bg-error/15 text-error',
  high: 'bg-warning/15 text-warning',
  normal: 'bg-info/15 text-info',
  low: 'bg-surface-hover text-text-muted',
};

const defaultOverdueColumns: ColumnDefinition[] = [
  { key: 'name', label: 'Task', align: 'left' },
  { key: 'assignee', label: 'Assignee', align: 'left' },
  { key: 'priority', label: 'Priority', align: 'left', format: 'priority' },
  { key: 'list', label: 'List', align: 'left' },
  { key: 'daysOverdue', label: 'Overdue', align: 'right', format: 'number' },
];

interface TableWidgetProps {
  title?: string;
  config?: TableWidgetConfig;
}

export default function TableWidget({ title, config }: TableWidgetProps) {
  const { workspace_id } = useWorkspace();
  const { data: hookData } = useOverdueTasksData(workspace_id);

  const data = config?.data ?? hookData;
  const columns = config?.columns ?? defaultOverdueColumns;
  const sortable = config?.sortable ?? true;
  const emptyMessage = config?.emptyMessage ?? 'No data available';
  const maxRows = config?.maxRows;

  const [sortKey, setSortKey] = useState<string>(
    config?.defaultSortKey ?? columns[columns.length - 1]?.key ?? ''
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(config?.defaultSortDir ?? 'desc');

  const sorted = useMemo(() => {
    const rows = [...data] as Array<Record<string, unknown>>;
    if (!sortable || !sortKey) return maxRows ? rows.slice(0, maxRows) : rows;

    rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal ?? '').localeCompare(String(bVal ?? ''))
        : String(bVal ?? '').localeCompare(String(aVal ?? ''));
    });

    return maxRows ? rows.slice(0, maxRows) : rows;
  }, [data, sortKey, sortDir, sortable, maxRows]);

  function toggleSort(key: string) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (!sortable) return null;
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent" />
    );
  }

  function renderCell(row: Record<string, unknown>, col: ColumnDefinition) {
    const value = row[col.key];
    const displayValue = value == null ? '—' : String(value);

    switch (col.format) {
      case 'priority': {
        const strVal = String(displayValue).toLowerCase();
        const colors = col.badgeColors ?? defaultPriorityColors;
        const colorClass = colors[strVal] ?? 'bg-surface-hover text-text-muted';
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
            {String(displayValue)}
          </span>
        );
      }
      case 'badge': {
        const strVal = String(displayValue).toLowerCase();
        const colors = col.badgeColors ?? {};
        const colorClass = colors[strVal] ?? 'bg-accent/15 text-accent';
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
            {String(displayValue)}
          </span>
        );
      }
      case 'number':
        return (
          <span className="font-mono text-text-primary font-medium">
            {typeof value === 'number' ? value.toLocaleString() : displayValue}
            {col.key === 'daysOverdue' && typeof value === 'number' ? 'd' : ''}
          </span>
        );
      case 'date':
        return (
          <span className="text-text-secondary">
            {typeof value === 'string' ? new Date(value).toLocaleDateString() : String(displayValue)}
          </span>
        );
      default:
        return <span>{String(displayValue)}</span>;
    }
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2.5 px-3 font-medium text-text-muted text-xs uppercase tracking-wider transition-colors ${
                  sortable ? 'cursor-pointer hover:text-text-secondary' : ''
                } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {col.label}
                  <SortIcon col={col.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr
              key={(row.id as string) ?? idx}
              className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 px-3 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.key === columns[0]?.key ? 'text-text-primary font-medium max-w-[200px] truncate' : 'text-text-secondary'}`}
                >
                  {renderCell(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
