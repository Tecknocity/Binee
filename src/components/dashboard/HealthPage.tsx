'use client';

import {
  RefreshCw,
  Clock,
  ListChecks,
  AlertTriangle,
  Users,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useHealth } from '@/hooks/useHealth';
import HealthScoreCircle from './HealthScoreCircle';
import IssueCard from './IssueCard';

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4 flex items-center gap-4 hover:border-border-light transition-colors">
      <div className="rounded-xl bg-accent/10 p-2.5">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-secondary">{label}</p>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-navy-dark border border-border px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">Score: {payload[0].value}</p>
    </div>
  );
}

export default function HealthPage() {
  const { healthResult, metrics, historicalScores, isLoading, lastCheckAt, runCheck } =
    useHealth();

  if (isLoading && !healthResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
        <p className="text-sm text-text-muted">Running health check...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Health Monitor</h1>
          <p className="text-sm text-text-secondary mt-1">
            Continuous workspace analysis to find issues and optimize workflows
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastCheckAt && (
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Last check:{' '}
              {new Date(lastCheckAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={runCheck}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Run Health Check
          </button>
        </div>
      </div>

      {/* Score + Quick Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-start">
        {/* Score circle */}
        <div className="flex justify-center lg:justify-start">
          <div className="rounded-2xl bg-surface border border-border p-8">
            <HealthScoreCircle score={healthResult?.overall_score ?? 0} />
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            icon={ListChecks}
            label="Active Tasks"
            value={metrics?.activeTasks ?? 0}
            sub={`${metrics?.tasksDueToday ?? 0} due today`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Overdue Tasks"
            value={metrics?.overdueTasks ?? 0}
            sub={`of ${metrics?.totalTasks ?? 0} total`}
          />
          <MetricCard
            icon={Users}
            label="Active Members"
            value={`${metrics?.activeMembers7d ?? 0}/${metrics?.totalMembers ?? 0}`}
            sub="in the past 7 days"
          />
          <MetricCard
            icon={TrendingUp}
            label="Velocity"
            value={`${metrics?.tasksClosed7d ?? 0}/wk`}
            sub={metrics?.velocityTrend === 'improving' ? 'Trending up' : metrics?.velocityTrend === 'declining' ? 'Trending down' : 'Stable'}
          />
        </div>
      </div>

      {/* Issues */}
      {healthResult && healthResult.issues.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Issues</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-error/10 text-error">
              {healthResult.issues.length}
            </span>
          </div>
          <div className="space-y-3">
            {healthResult.issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>
      )}

      {/* Trend Chart */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Health Score Trend (30 days)
        </h2>
        <div className="rounded-2xl bg-surface border border-border p-6">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historicalScores} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={4}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6B6B80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#FF6B35"
                strokeWidth={2}
                fill="url(#healthGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#FF6B35', stroke: '#1A1A2E', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Category Score Breakdown */}
      {healthResult?.category_scores && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Score Breakdown</h2>
          <div className="rounded-2xl bg-surface border border-border p-6 space-y-5">
            {Object.entries(healthResult.category_scores).map(([key, value]) => {
              const maxScores: Record<string, number> = {
                overdue_tasks: 25,
                unassigned_tasks: 20,
                list_activity: 20,
                team_activity: 20,
                task_hygiene: 15,
              };
              const max = maxScores[key] ?? 25;
              const pct = (Number(value) / max) * 100;
              const label = key
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">{label}</span>
                    <span className="text-sm font-medium text-text-primary tabular-nums">
                      {value}/{max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-navy-base overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          pct > 70
                            ? 'var(--color-success)'
                            : pct > 40
                            ? 'var(--color-warning)'
                            : 'var(--color-error)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
