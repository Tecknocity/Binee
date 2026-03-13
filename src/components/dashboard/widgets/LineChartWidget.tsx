'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getLineChartData } from '@/hooks/useDashboard';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{payload[0].value} completed</p>
    </div>
  );
}

interface LineChartWidgetProps {
  title?: string;
}

export default function LineChartWidget({ title }: LineChartWidgetProps) {
  const data = getLineChartData();

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="lineWidgetGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="week"
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
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="completed"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="url(#lineWidgetGradient)"
          dot={{ r: 3, fill: 'var(--color-accent)', stroke: 'var(--chart-dot-stroke)', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: 'var(--color-accent)', stroke: 'var(--chart-dot-stroke)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
