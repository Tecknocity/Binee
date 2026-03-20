'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { usePriorityBreakdownData } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

const PRIORITY_COLORS = {
  urgent: '#EF4444',
  high: '#F59E0B',
  normal: '#854DF9',
  low: '#6B6B80',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs text-text-primary flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

interface PriorityBreakdownWidgetProps {
  title?: string;
}

export default function PriorityBreakdownWidget({ title }: PriorityBreakdownWidgetProps) {
  const { workspace_id } = useWorkspace();
  const { data } = usePriorityBreakdownData(workspace_id);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="list"
          tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--chart-grid)' }}
        />
        <YAxis
          tick={{ fill: 'var(--chart-tick-secondary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
        <Legend content={<CustomLegend />} />
        <Bar dataKey="urgent" stackId="a" fill={PRIORITY_COLORS.urgent} maxBarSize={36} />
        <Bar dataKey="high" stackId="a" fill={PRIORITY_COLORS.high} maxBarSize={36} />
        <Bar dataKey="normal" stackId="a" fill={PRIORITY_COLORS.normal} maxBarSize={36} />
        <Bar dataKey="low" stackId="a" fill={PRIORITY_COLORS.low} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
