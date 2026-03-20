'use client';

import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useOverdueTasksData, type OverdueTask } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

type SortKey = keyof OverdueTask;
type SortDir = 'asc' | 'desc';

const priorityColors: Record<string, string> = {
  urgent: 'bg-error/15 text-error',
  high: 'bg-warning/15 text-warning',
  normal: 'bg-info/15 text-info',
  low: 'bg-surface-hover text-text-muted',
};

interface TableWidgetProps {
  title?: string;
}

export default function TableWidget({ title }: TableWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('daysOverdue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { workspace_id } = useWorkspace();
  const { data } = useOverdueTasksData(workspace_id);

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent" />
    );
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'name', label: 'Task', className: 'text-left' },
    { key: 'assignee', label: 'Assignee', className: 'text-left' },
    { key: 'priority', label: 'Priority', className: 'text-left' },
    { key: 'list', label: 'List', className: 'text-left' },
    { key: 'daysOverdue', label: 'Overdue', className: 'text-right' },
  ];

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No overdue tasks
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
                className={`py-2.5 px-3 font-medium text-text-muted text-xs uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors ${col.className ?? ''}`}
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
          {sorted.map((task) => (
            <tr
              key={task.id}
              className="border-b border-border/50 hover:bg-surface-hover/50 transition-colors"
            >
              <td className="py-2.5 px-3 text-text-primary font-medium max-w-[200px] truncate">
                {task.name}
              </td>
              <td className="py-2.5 px-3 text-text-secondary">{task.assignee}</td>
              <td className="py-2.5 px-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}
                >
                  {task.priority}
                </span>
              </td>
              <td className="py-2.5 px-3 text-text-secondary">{task.list}</td>
              <td className="py-2.5 px-3 text-right">
                <span className="text-error font-medium">
                  {task.daysOverdue}d
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
