'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useLineChartData } from '@/hooks/useDashboard';
import { useWorkspace } from '@/hooks/useWorkspace';

interface LineDefinition {
  dataKey: string;
  color?: string;
  label?: string;
  strokeWidth?: number;
}

interface LineChartWidgetConfig {
  data?: Array<Record<string, unknown>>;
  xAxisKey?: string;
  lines?: LineDefinition[];
  showArea?: boolean;
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

interface LineChartWidgetProps {
  title?: string;
  config?: LineChartWidgetConfig;
}

export default function LineChartWidget({ title, config }: LineChartWidgetProps) {
  const { workspace_id } = useWorkspace();
  const { data: hookData } = useLineChartData(workspace_id);

  const data = config?.data ?? hookData;
  const xAxisKey = config?.xAxisKey ?? 'week';
  const showArea = config?.showArea ?? true;
  const height = config?.height ?? 240;
  const showLegend = config?.showLegend ?? false;
  const showGrid = config?.showGrid ?? true;
  const tooltipSuffix = config?.tooltipSuffix ?? 'completed';

  const lines: LineDefinition[] = config?.lines ?? [
    { dataKey: 'completed', color: 'var(--color-accent)', label: 'Completed', strokeWidth: 2 },
  ];

  // Generate unique gradient IDs to avoid collisions with multiple lines
  const gradientIds = useMemo(
    () => lines.map((line, i) => `lineWidgetGradient-${i}-${line.dataKey}`),
    [lines]
  );

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No data available
      </div>
    );
  }

  const sharedAxisProps = {
    xAxis: (
      <XAxis
        dataKey={xAxisKey}
        tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: 'var(--chart-grid)' }}
      />
    ),
    yAxis: (
      <YAxis
        tick={{ fill: 'var(--chart-tick-secondary)', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={30}
      />
    ),
  };

  if (showArea) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            {lines.map((line, i) => (
              <linearGradient key={gradientIds[i]} id={gradientIds[i]} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.color ?? 'var(--color-accent)'} stopOpacity={0.25} />
                <stop offset="95%" stopColor={line.color ?? 'var(--color-accent)'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />}
          {sharedAxisProps.xAxis}
          {sharedAxisProps.yAxis}
          <Tooltip content={<CustomTooltip suffix={tooltipSuffix} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--chart-tick)' }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {lines.map((line, i) => (
            <Area
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label ?? line.dataKey}
              stroke={line.color ?? 'var(--color-accent)'}
              strokeWidth={line.strokeWidth ?? 2}
              fill={`url(#${gradientIds[i]})`}
              dot={{
                r: 3,
                fill: line.color ?? 'var(--color-accent)',
                stroke: 'var(--chart-dot-stroke)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: line.color ?? 'var(--color-accent)',
                stroke: 'var(--chart-dot-stroke)',
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />}
        {sharedAxisProps.xAxis}
        {sharedAxisProps.yAxis}
        <Tooltip content={<CustomTooltip suffix={tooltipSuffix} />} />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--chart-tick)' }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.label ?? line.dataKey}
            stroke={line.color ?? 'var(--color-accent)'}
            strokeWidth={line.strokeWidth ?? 2}
            dot={{
              r: 3,
              fill: line.color ?? 'var(--color-accent)',
              stroke: 'var(--chart-dot-stroke)',
              strokeWidth: 2,
            }}
            activeDot={{
              r: 5,
              fill: line.color ?? 'var(--color-accent)',
              stroke: 'var(--chart-dot-stroke)',
              strokeWidth: 2,
            }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
