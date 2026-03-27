'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import type { CreditTransaction } from '@/types/database';

interface DailyUsage {
  date: string;
  credits: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">
        {payload[0].value} credits used
      </p>
    </div>
  );
}

export default function CreditUsageChart() {
  const { workspace } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    supabase
      .from('credit_transactions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('type', 'deduction')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTransactions((data as CreditTransaction[]) || []);
        setLoading(false);
      });
  }, [workspace?.id]);

  const chartData = useMemo<DailyUsage[]>(() => {
    const dailyMap = new Map<string, number>();

    // Fill last 30 days with zeros
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(key, 0);
    }

    // Aggregate deductions by day
    transactions.forEach((tx) => {
      const d = new Date(tx.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) || 0) + Math.abs(tx.amount));
      }
    });

    return Array.from(dailyMap.entries()).map(([date, credits]) => ({
      date,
      credits,
    }));
  }, [transactions]);

  const totalUsed = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

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
          <h3 className="text-base font-medium text-text-primary">Credit Usage</h3>
          <p className="text-sm text-text-secondary">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-lg font-bold text-text-primary font-mono">{Math.round(totalUsed * 10) / 10}</p>
            <p className="text-xs text-text-muted">credits used</p>
          </div>
          <TrendingDown className="w-4 h-4 text-text-muted" />
        </div>
      </div>

      {totalUsed === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-text-muted text-sm">
          No usage data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="creditUsageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={30}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="credits"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#creditUsageGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--color-accent)',
                stroke: 'var(--chart-dot-stroke)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
