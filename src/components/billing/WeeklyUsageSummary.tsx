'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface WeeklyData {
  week: string;
  total: number;
  chat: number;
  setup: number;
}

const ACTION_COLORS: Record<string, string> = {
  chat: 'var(--color-accent)',
  setup: '#eab308',
};

const ACTION_LABELS: Record<string, string> = {
  chat: 'Chat',
  setup: 'Setup',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

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
          <span className="font-mono font-medium text-text-primary">{Math.round(entry.value * 10) / 10}</span>
        </div>
      ))}
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

export default function WeeklyUsageSummary() {
  const { workspace } = useAuth();
  const [data, setData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    // Query credit_usage table which has workspace_id (added in migration 031)
    // instead of weekly_usage_summaries which is user-scoped without workspace_id.
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    Promise.resolve(
      supabase
        .from('credit_usage')
        .select('action_type, credits_deducted, created_at')
        .eq('workspace_id', workspace.id)
        .gte('created_at', eightWeeksAgo.toISOString())
        .order('created_at', { ascending: true }),
    )
      .then(({ data: rows, error }) => {
        if (error) {
          console.error('[WeeklyUsageSummary] Query failed:', error.message);
          setLoading(false);
          return;
        }

        // Build all 8 weeks (including empty ones) so the chart always shows the full range
        const weekMap = new Map<string, WeeklyData>();

        // Pre-fill all 8 weeks starting from the current week going back
        const now = new Date();
        const currentWeekStart = getWeekStart(now);
        for (let i = 7; i >= 0; i--) {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() - i * 7);
          const weekKey = d.toISOString().slice(0, 10);
          weekMap.set(weekKey, {
            week: d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            total: 0,
            chat: 0,
            setup: 0,
          });
        }

        if (rows && rows.length > 0) {
          for (const row of rows) {
            const weekKey = getWeekStart(new Date(row.created_at));
            const entry = weekMap.get(weekKey);
            if (!entry) continue; // outside the 8-week window

            const credits = Number(row.credits_deducted ?? 0);
            entry.total += credits;
            // Map action_type to chart bucket: orchestrator/general_chat → chat, setup → setup
            const rawType = row.action_type ?? '';
            const bucket: 'chat' | 'setup' =
              rawType === 'setup' ? 'setup' : 'chat';
            entry[bucket] += credits;
          }
        }

        // Sort by week key (already in order, but ensure it)
        const sorted = Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v);

        setData(sorted);

        setLoading(false);
      })
      .catch(() => {
        // Ensure spinner is cleared even on unexpected errors
        setLoading(false);
      });
  }, [workspace?.id]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-center h-[280px]">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    );
  }

  const totalCredits = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            Weekly Usage
          </h3>
          <p className="text-sm text-text-secondary">Last 8 weeks</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-text-primary font-mono">{Math.round(totalCredits * 10) / 10}</p>
          <p className="text-xs text-text-muted">total credits</p>
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
            />
            <YAxis
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="chat" stackId="usage" fill={ACTION_COLORS.chat} radius={[0, 0, 0, 0]} />
            <Bar dataKey="setup" stackId="usage" fill={ACTION_COLORS.setup} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ACTION_COLORS[key] }}
              />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
