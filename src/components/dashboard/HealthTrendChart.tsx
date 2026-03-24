'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WeeklySnapshot, ScoreDelta } from '@/hooks/useHealth';

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">
        Score: <span className="font-mono">{payload[0].value}</span>
      </p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: ScoreDelta }) {
  const absChange = Math.abs(delta.change);

  if (delta.direction === 'up') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10">
        <TrendingUp className="w-4 h-4 text-success" />
        <span className="text-sm font-medium text-success tabular-nums">+{absChange}</span>
        <span className="text-xs text-text-muted">vs last week</span>
      </div>
    );
  }

  if (delta.direction === 'down') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-error/10">
        <TrendingDown className="w-4 h-4 text-error" />
        <span className="text-sm font-medium text-error tabular-nums">-{absChange}</span>
        <span className="text-xs text-text-muted">vs last week</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface">
      <Minus className="w-4 h-4 text-text-muted" />
      <span className="text-sm font-medium text-text-secondary">No change</span>
      <span className="text-xs text-text-muted">vs last week</span>
    </div>
  );
}

interface HealthTrendChartProps {
  snapshots: WeeklySnapshot[];
  delta: ScoreDelta | null;
}

export default function HealthTrendChart({ snapshots, delta }: HealthTrendChartProps) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-border p-8 flex flex-col items-center gap-2">
        <p className="text-sm text-text-muted">
          No weekly snapshots yet. Trend data will appear after the first weekly health check runs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface border border-border p-6">
      {/* Header with delta badge */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-text-secondary">Week-over-week health score</p>
        </div>
        {delta && <DeltaBadge delta={delta} />}
      </div>

      {/* Line chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={snapshots} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="trendLineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="week"
            tick={{ fill: 'var(--chart-tick-secondary)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--chart-tick-secondary)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            dot={{
              r: 4,
              fill: 'var(--color-accent)',
              stroke: 'var(--chart-dot-stroke)',
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: 'var(--color-accent)',
              stroke: 'var(--chart-dot-stroke)',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
