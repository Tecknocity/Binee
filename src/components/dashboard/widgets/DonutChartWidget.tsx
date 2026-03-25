'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTaskStatusData } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

const STATUS_COLORS: Record<string, string> = {
  'In Progress': '#854DF9',
  'To Do': '#6B6B80',
  'In Review': '#F59E0B',
  'Done': '#22C55E',
  'Blocked': '#EF4444',
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-0.5">{payload[0].name}</p>
      <p className="text-sm font-medium text-text-primary">{payload[0].value} tasks</p>
    </div>
  );
}

interface DonutChartWidgetProps {
  title?: string;
}

export default function DonutChartWidget({ title }: DonutChartWidgetProps) {
  const { workspace_id } = useWorkspace();
  const { data } = useTaskStatusData(workspace_id);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="55%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#6B6B80'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2.5 min-w-0">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2.5 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: STATUS_COLORS[entry.name] ?? '#6B6B80' }}
            />
            <span className="text-text-secondary truncate">{entry.name}</span>
            <span className="text-text-primary font-medium ml-auto tabular-nums">
              {entry.value}
            </span>
            <span className="text-text-muted text-xs tabular-nums w-10 text-right">
              {((entry.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
