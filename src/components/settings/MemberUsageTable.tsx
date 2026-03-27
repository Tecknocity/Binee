'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface MemberUsage {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  total_credits: number;
}

export default function MemberUsageTable() {
  const { workspace } = useAuth();
  const [members, setMembers] = useState<MemberUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    async function fetchMemberUsage() {
      // Get credit transactions for current billing period
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch members and transactions in parallel
      const [membersResult, txResult] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('user_id, display_name, email, avatar_url')
          .eq('workspace_id', workspace!.id)
          .eq('status', 'active'),
        supabase
          .from('credit_transactions')
          .select('user_id, amount')
          .eq('workspace_id', workspace!.id)
          .eq('type', 'deduction')
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const memberData = membersResult.data;
      const txData = txResult.data;

      if (!memberData?.length) {
        setLoading(false);
        return;
      }

      // Aggregate usage per member
      const usageMap = new Map<string, number>();
      txData?.forEach((tx) => {
        if (tx.user_id) {
          usageMap.set(tx.user_id, (usageMap.get(tx.user_id) || 0) + Math.abs(tx.amount));
        }
      });

      const combined: MemberUsage[] = memberData.map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name || m.email.split('@')[0],
        email: m.email,
        avatar_url: m.avatar_url,
        total_credits: usageMap.get(m.user_id) || 0,
      }));

      // Sort by usage descending
      combined.sort((a, b) => b.total_credits - a.total_credits);
      setMembers(combined);
      setLoading(false);
    }

    fetchMemberUsage();
  }, [workspace?.id]);

  const maxUsage = Math.max(...members.map((m) => m.total_credits), 1);

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

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-text-muted" />
        <h3 className="text-base font-medium text-text-primary">Usage Per Member</h3>
        <span className="text-xs text-text-muted ml-auto">This month</span>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No member usage data yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left px-3 py-2.5 font-medium">Member</th>
                <th className="text-right px-3 py-2.5 font-medium w-24">Credits</th>
                <th className="text-left px-3 py-2.5 font-medium w-40">Usage</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-accent">
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
                    {Math.round(member.total_credits * 10) / 10}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="h-2 bg-border/50 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          member.total_credits > 0 ? 'bg-accent' : 'bg-transparent'
                        )}
                        style={{ width: `${(member.total_credits / maxUsage) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
