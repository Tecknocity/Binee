'use client';

import { useState, useEffect } from 'react';
import { Clock, Download, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn, formatDate } from '@/lib/utils';
import type { CreditTransaction } from '@/types/database';

export default function BillingHistory() {
  const { workspace } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;

    const supabase = createBrowserClient();

    supabase
      .from('credit_transactions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setTransactions((data as CreditTransaction[]) || []);
        setLoading(false);
      });
  }, [workspace?.id]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-base font-medium text-text-primary mb-4">Billing History</h3>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-text-muted" />
          <h3 className="text-base font-medium text-text-primary">Billing History</h3>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="p-8 text-center">
          <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No transactions yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left px-4 py-3 font-medium">Description</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
                <th className="text-right px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-text-primary">{tx.description}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        tx.type === 'deduction' && 'bg-error/10 text-error',
                        tx.type === 'purchase' && 'bg-success/10 text-success',
                        tx.type === 'bonus' && 'bg-warning/10 text-warning',
                        tx.type === 'refund' && 'bg-accent/10 text-accent',
                        tx.type === 'monthly_reset' && 'bg-accent/10 text-accent'
                      )}
                    >
                      {tx.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono font-medium',
                      tx.amount < 0 ? 'text-error' : 'text-success'
                    )}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">
                    {tx.balance_after}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted whitespace-nowrap">
                    {formatDate(tx.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Placeholder: Invoice downloads will be available with Stripe (B-090) */}
      <div className="px-6 py-3 border-t border-border bg-navy-dark/30">
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <Download className="w-3.5 h-3.5" />
          <span>Invoice downloads available soon</span>
        </div>
      </div>
    </div>
  );
}
