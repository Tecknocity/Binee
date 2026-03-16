'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTimeTrackingData } from '@/hooks/useDashboard';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{payload[0].value}h logged</p>
    </div>
  );
}

interface TimeTrackingWidgetProps {
  title?: string;
}

export default function TimeTrackingWidget({ title }: TimeTrackingWidgetProps) {
  const data = getTimeTrackingData();

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No time tracking data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--chart-grid)' }}
        />
        <YAxis
          tick={{ fill: 'var(--chart-tick-secondary)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={30}
          unit="h"
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
        <Bar dataKey="hours" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
