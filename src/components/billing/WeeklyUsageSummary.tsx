'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface WeeklyData {
  weekKey: string;
  week: string;
  total: number;
  chat: number;
  setup: number;
  isCurrentWeek: boolean;
}

type Period = 4 | 8 | 12;

const ACTION_COLORS: Record<string, string> = {
  chat: 'var(--color-accent)',
  setup: '#eab308',
};

const ACTION_LABELS: Record<string, string> = {
  chat: 'Chat',
  setup: 'Setup',
};

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 4, label: '4 weeks' },
  { value: 8, label: '8 weeks' },
  { value: 12, label: '12 weeks' },
];

/** Format a number cleanly: 10.0 → "10", 2.3 → "2.3" */
function formatCredits(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2.5 shadow-lg">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-text-secondary">{ACTION_LABELS[entry.dataKey] ?? entry.dataKey}</span>
          </div>
          <span className="font-mono font-medium text-text-primary">{formatCredits(entry.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-4 text-xs border-t border-border/50 mt-1 pt-1">
          <span className="text-text-secondary">Total</span>
          <span className="font-mono font-medium text-text-primary">{formatCredits(total)}</span>
        </div>
      )}
    </div>
  );
}

/** Get the Monday (start of week) for a given date */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/** Format a week range label like "Mar 22–28" or "Mar 29–Apr 4" */
function formatWeekRange(weekStartISO: string): string {
  const start = new Date(weekStartISO + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

export default function WeeklyUsageSummary() {
  const { workspace } = useAuth();
  const [allRows, setAllRows] = useState<Array<{ action_type: string; credits_deducted: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(8);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    // Fetch 12 weeks of data (max period) so we can switch without re-fetching
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    Promise.resolve(
      supabase
        .from('credit_usage')
        .select('action_type, credits_deducted, created_at')
        .eq('workspace_id', workspace.id)
        .gte('created_at', twelveWeeksAgo.toISOString())
        .order('created_at', { ascending: true }),
    )
      .then(({ data: rows, error }) => {
        if (error) {
          console.error('[WeeklyUsageSummary] Query failed:', error.message);
        } else {
          setAllRows(rows ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace?.id]);

  const { data, totalCredits, trend } = useMemo(() => {
    const now = new Date();
    const currentWeekStartStr = getWeekStart(now);

    // Build week slots
    const weekMap = new Map<string, WeeklyData>();
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(currentWeekStartStr + 'T00:00:00');
      d.setDate(d.getDate() - i * 7);
      const weekKey = d.toISOString().slice(0, 10);
      weekMap.set(weekKey, {
        weekKey,
        week: formatWeekRange(weekKey),
        total: 0,
        chat: 0,
        setup: 0,
        isCurrentWeek: weekKey === currentWeekStartStr,
      });
    }

    // Fill in data
    for (const row of allRows) {
      const weekKey = getWeekStart(new Date(row.created_at));
      const entry = weekMap.get(weekKey);
      if (!entry) continue;

      const credits = Number(row.credits_deducted ?? 0);
      entry.total += credits;
      const bucket: 'chat' | 'setup' = (row.action_type ?? '') === 'setup' ? 'setup' : 'chat';
      entry[bucket] += credits;
    }

    const sorted = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    const total = sorted.reduce((s, d) => s + d.total, 0);

    // Calculate trend: compare this period's total vs the previous period
    // We need to look at data outside the current window for the previous period
    const periodStart = new Date(currentWeekStartStr + 'T00:00:00');
    periodStart.setDate(periodStart.getDate() - (period - 1) * 7);
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - period * 7);

    let prevTotal = 0;
    for (const row of allRows) {
      const d = new Date(row.created_at);
      if (d >= prevPeriodStart && d < periodStart) {
        prevTotal += Number(row.credits_deducted ?? 0);
      }
    }

    let trendPct: number | null = null;
    if (prevTotal > 0) {
      trendPct = ((total - prevTotal) / prevTotal) * 100;
    } else if (total > 0) {
      trendPct = 100;
    }

    return { data: sorted, totalCredits: total, trend: trendPct };
  }, [allRows, period]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-center h-[280px]">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            Weekly Usage
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-md transition-colors',
                  period === opt.value
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-text-primary font-mono">{formatCredits(totalCredits)}</p>
          <p className="text-xs text-text-muted">total credits</p>
          {trend !== null && (
            <div className={cn(
              'flex items-center justify-end gap-0.5 text-xs mt-0.5',
              trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-text-muted'
            )}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              <span>{trend > 0 ? '+' : ''}{Math.round(trend)}% vs prior</span>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-text-muted text-sm">
          No usage data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              interval={0}
              angle={period > 8 ? -25 : 0}
              textAnchor={period > 8 ? 'end' : 'middle'}
              height={period > 8 ? 50 : 30}
            />
            <YAxis
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              label={{
                value: 'credits',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: 'var(--chart-tick)', fontSize: 10 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="chat" stackId="usage" fill={ACTION_COLORS.chat} radius={[0, 0, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.weekKey}
                  fill={ACTION_COLORS.chat}
                  opacity={entry.isCurrentWeek ? 0.6 : 1}
                />
              ))}
            </Bar>
            <Bar dataKey="setup" stackId="usage" fill={ACTION_COLORS.setup} radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.weekKey}
                  fill={ACTION_COLORS.setup}
                  opacity={entry.isCurrentWeek ? 0.6 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ACTION_COLORS[key] }}
              />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-text-muted ml-2">
            <span className="w-2 h-2 rounded-full bg-accent/50" />
            Current week (partial)
          </div>
        </div>
      )}
    </div>
  );
}
