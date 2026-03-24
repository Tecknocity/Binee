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
import { useBarChartData } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

interface BarDefinition {
  dataKey: string;
  color?: string;
  label?: string;
  radius?: [number, number, number, number];
  stackId?: string;
}

interface BarChartWidgetConfig {
  data?: Array<Record<string, unknown>>;
  xAxisKey?: string;
  bars?: BarDefinition[];
  tooltipSuffix?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

function CustomTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium text-text-primary">
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value} {suffix ?? entry.name}
        </p>
      ))}
    </div>
  );
}

interface BarChartWidgetProps {
  title?: string;
  config?: BarChartWidgetConfig;
}

export default function BarChartWidget({ title, config }: BarChartWidgetProps) {
  const { workspace_id } = useWorkspace();
  const { data: hookData } = useBarChartData(workspace_id);

  const data = config?.data ?? hookData;
  const xAxisKey = config?.xAxisKey ?? 'name';
  const height = config?.height ?? 240;
  const showLegend = config?.showLegend ?? false;
  const showGrid = config?.showGrid ?? true;
  const tooltipSuffix = config?.tooltipSuffix ?? 'tasks';

  const bars: BarDefinition[] = config?.bars ?? [
    { dataKey: 'completed', color: 'var(--color-accent)', label: 'Completed' },
  ];

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        )}
        <XAxis
          dataKey={xAxisKey}
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
        <Tooltip
          content={<CustomTooltip suffix={tooltipSuffix} />}
          cursor={{ fill: 'var(--chart-cursor)' }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--chart-tick)' }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.label ?? bar.dataKey}
            fill={bar.color ?? 'var(--color-accent)'}
            radius={bar.radius ?? [4, 4, 0, 0]}
            maxBarSize={40}
            stackId={bar.stackId}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
