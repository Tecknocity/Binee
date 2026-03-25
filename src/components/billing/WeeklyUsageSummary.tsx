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
  health_check: number;
  setup: number;
  dashboard: number;
  briefing: number;
}

const ACTION_COLORS: Record<string, string> = {
  chat: 'var(--color-accent)',
  health_check: '#22c55e',
  setup: '#eab308',
  dashboard: '#3b82f6',
  briefing: '#f97316',
};

const ACTION_LABELS: Record<string, string> = {
  chat: 'Chat',
  health_check: 'Health Check',
  setup: 'Setup',
  dashboard: 'Dashboard',
  briefing: 'Briefing',
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
          <span className="font-mono font-medium text-text-primary">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyUsageSummary() {
  const { workspace } = useAuth();
  const [data, setData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    supabase
      .from('weekly_usage_summaries')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('week_start', { ascending: true })
      .limit(8)
      .then(({ data: rows }) => {
        if (rows) {
          setData(
            rows.map((r) => ({
              week: new Date(String(r.week_start)).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
              total: Number(r.total_credits ?? 0),
              chat: Number(r.chat_credits ?? 0),
              health_check: Number(r.health_check_credits ?? 0),
              setup: Number(r.setup_credits ?? 0),
              dashboard: Number(r.dashboard_credits ?? 0),
              briefing: Number(r.briefing_credits ?? 0),
            }))
          );
        }
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
          <p className="text-lg font-bold text-text-primary font-mono">{totalCredits}</p>
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
            <Bar dataKey="health_check" stackId="usage" fill={ACTION_COLORS.health_check} />
            <Bar dataKey="setup" stackId="usage" fill={ACTION_COLORS.setup} />
            <Bar dataKey="dashboard" stackId="usage" fill={ACTION_COLORS.dashboard} />
            <Bar dataKey="briefing" stackId="usage" fill={ACTION_COLORS.briefing} radius={[3, 3, 0, 0]} />
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
