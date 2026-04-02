'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Loader2, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface MemberUsage {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  total_credits: number;
  chat_credits: number;
  setup_credits: number;
  last_active: string | null;
}

type TimePeriod = 'this_week' | 'this_month' | 'last_30' | 'all_time';
type SortField = 'credits' | 'name' | 'last_active';

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'all_time', label: 'All time' },
];

const AVATAR_COLORS = [
  'bg-accent/15 text-accent',
  'bg-emerald-500/15 text-emerald-400',
  'bg-amber-500/15 text-amber-400',
  'bg-sky-500/15 text-sky-400',
  'bg-rose-500/15 text-rose-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-teal-500/15 text-teal-400',
  'bg-orange-500/15 text-orange-400',
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/** Format a number cleanly: 10.0 → "10", 2.3 → "2.3" */
function formatCredits(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getPeriodStart(period: TimePeriod): Date | null {
  const now = new Date();
  switch (period) {
    case 'this_week': {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'this_month': {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'last_30': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'all_time':
      return null;
  }
}

export default function MemberUsageTable() {
  const { workspace } = useAuth();
  const [memberData, setMemberData] = useState<Array<{
    user_id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
  }>>([]);
  const [usageData, setUsageData] = useState<Array<{
    user_id: string;
    credits_deducted: number;
    action_type: string;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('this_month');
  const [sortField, setSortField] = useState<SortField>('credits');
  const [sortAsc, setSortAsc] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  // Fetch members once, re-fetch transactions when period changes
  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    supabase
      .from('workspace_members')
      .select('user_id, display_name, email, avatar_url')
      .eq('workspace_id', workspace.id)
      .eq('status', 'active')
      .then(({ data, error }) => {
        if (error) {
          console.error('[MemberUsageTable] Members query failed:', error.message);
        } else {
          setMemberData(data ?? []);
        }
      });
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id) return;

    setLoading(true);
    const supabase = createBrowserClient();

    // Use credit_usage table — same source of truth as WeeklyUsageSummary
    const periodStart = getPeriodStart(period);

    let query = supabase
      .from('credit_usage')
      .select('user_id, credits_deducted, action_type, created_at')
      .eq('workspace_id', workspace.id);

    if (periodStart) {
      query = query.gte('created_at', periodStart.toISOString());
    }

    Promise.resolve(
      query
        .order('created_at', { ascending: false })
        .limit(5000),
    )
      .then(({ data, error }) => {
        if (error) {
          console.error('[MemberUsageTable] Usage query failed:', error.message);
        } else {
          setUsageData(data ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace?.id, period]);

  const members = useMemo(() => {
    if (!memberData.length) return [];

    // Aggregate from credit_usage (same table as WeeklyUsageSummary)
    const usageMap = new Map<string, { total: number; chat: number; setup: number; lastActive: string | null }>();
    for (const row of usageData) {
      if (!row.user_id) continue;

      const entry = usageMap.get(row.user_id) ?? { total: 0, chat: 0, setup: 0, lastActive: null };
      const credits = Number(row.credits_deducted ?? 0);
      entry.total += credits;

      // Use action_type directly — same bucketing as WeeklyUsageSummary
      if (row.action_type === 'setup') {
        entry.setup += credits;
      } else {
        entry.chat += credits;
      }

      if (!entry.lastActive || row.created_at > entry.lastActive) {
        entry.lastActive = row.created_at;
      }

      usageMap.set(row.user_id, entry);
    }

    const combined: MemberUsage[] = memberData.map((m) => {
      const usage = usageMap.get(m.user_id);
      return {
        user_id: m.user_id,
        display_name: m.display_name || m.email.split('@')[0],
        email: m.email,
        avatar_url: m.avatar_url,
        total_credits: usage?.total ?? 0,
        chat_credits: usage?.chat ?? 0,
        setup_credits: usage?.setup ?? 0,
        last_active: usage?.lastActive ?? null,
      };
    });

    // Sort
    combined.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'credits':
          cmp = a.total_credits - b.total_credits;
          break;
        case 'name':
          cmp = a.display_name.localeCompare(b.display_name);
          break;
        case 'last_active':
          cmp = (a.last_active ?? '').localeCompare(b.last_active ?? '');
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return combined;
  }, [memberData, usageData, sortField, sortAsc]);

  const maxUsage = Math.max(...members.map((m) => m.total_credits), 1);
  const totalUsage = members.reduce((s, m) => s + m.total_credits, 0);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-base font-medium text-text-primary mb-4">Usage Per Member</h3>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    );
  }

  const currentPeriodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label;

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-text-muted" />
        <h3 className="text-base font-medium text-text-primary">Usage Per Member</h3>
        <div className="ml-auto relative">
          <button
            onClick={() => setShowPeriodMenu(!showPeriodMenu)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            {currentPeriodLabel}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showPeriodMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPeriodMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-navy-dark border border-border rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setPeriod(opt.value);
                      setShowPeriodMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      period === opt.value
                        ? 'text-accent bg-accent/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No members in this workspace</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left px-3 py-2.5 font-medium">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-text-secondary transition-colors">
                    Member
                    {sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}
                  </button>
                </th>
                <th className="text-right px-3 py-2.5 font-medium w-20">
                  <button onClick={() => handleSort('credits')} className="flex items-center justify-end gap-1 hover:text-text-secondary transition-colors ml-auto">
                    Credits
                    {sortField === 'credits' && <ArrowUpDown className="w-3 h-3" />}
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium w-44">Usage</th>
                <th className="text-right px-3 py-2.5 font-medium w-20">
                  <button onClick={() => handleSort('last_active')} className="flex items-center justify-end gap-1 hover:text-text-secondary transition-colors ml-auto">
                    Active
                    {sortField === 'last_active' && <ArrowUpDown className="w-3 h-3" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const chatPct = maxUsage > 0 ? (member.chat_credits / maxUsage) * 100 : 0;
                const setupPct = maxUsage > 0 ? (member.setup_credits / maxUsage) * 100 : 0;

                return (
                  <tr key={member.user_id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                          member.avatar_url ? '' : getAvatarColor(idx)
                        )}>
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium">
                              {member.display_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-text-primary text-sm truncate">{member.display_name}</p>
                          <p className="text-text-muted text-xs truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-text-primary">
                      {formatCredits(member.total_credits)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden flex">
                          {member.chat_credits > 0 && (
                            <div
                              className="h-full bg-accent transition-all"
                              style={{ width: `${chatPct}%` }}
                              title={`Chat: ${formatCredits(member.chat_credits)}`}
                            />
                          )}
                          {member.setup_credits > 0 && (
                            <div
                              className="h-full bg-amber-500 transition-all"
                              style={{ width: `${setupPct}%` }}
                              title={`Setup: ${formatCredits(member.setup_credits)}`}
                            />
                          )}
                        </div>
                        {totalUsage > 0 && member.total_credits > 0 && (
                          <span className="text-[10px] text-text-muted font-mono w-8 text-right">
                            {Math.round((member.total_credits / totalUsage) * 100)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn(
                        'text-xs',
                        member.last_active ? 'text-text-secondary' : 'text-text-muted'
                      )}>
                        {formatLastActive(member.last_active)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
