'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { Check, Coins, ArrowUpRight, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCredits, formatDate } from '@/lib/utils';
import type { CreditTransaction } from '@/types/database';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: 100,
    features: ['100 AI credits/month', '1 workspace', 'Basic health checks', 'Community support'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    credits: 1000,
    features: [
      '1,000 AI credits/month',
      '3 workspaces',
      'Full health monitoring',
      'Custom dashboards',
      'Email support',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    credits: 5000,
    features: [
      '5,000 AI credits/month',
      'Unlimited workspaces',
      'Advanced analytics',
      'AI-powered setup',
      'Priority support',
      'API access',
    ],
  },
];

const mockHistory: CreditTransaction[] = [
  {
    id: '1',
    workspace_id: 'ws_mock_001',
    user_id: 'usr_mock_001',
    amount: -5,
    balance_after: 487,
    type: 'deduction',
    description: 'Health check analysis',
    message_id: null,
    metadata: null,
    created_at: '2026-03-10T14:30:00Z',
  },
  {
    id: '2',
    workspace_id: 'ws_mock_001',
    user_id: 'usr_mock_001',
    amount: -12,
    balance_after: 492,
    type: 'deduction',
    description: 'Chat conversation (8 messages)',
    message_id: null,
    metadata: null,
    created_at: '2026-03-09T10:15:00Z',
  },
  {
    id: '3',
    workspace_id: 'ws_mock_001',
    user_id: 'usr_mock_001',
    amount: -20,
    balance_after: 504,
    type: 'deduction',
    description: 'Setup session: New marketing space',
    message_id: null,
    metadata: null,
    created_at: '2026-03-08T09:00:00Z',
  },
  {
    id: '4',
    workspace_id: 'ws_mock_001',
    user_id: null,
    amount: 1000,
    balance_after: 524,
    type: 'monthly_reset',
    description: 'Monthly credit allocation (Starter plan)',
    message_id: null,
    metadata: null,
    created_at: '2026-03-01T00:00:00Z',
  },
];

export default function BillingSettings() {
  const { workspace } = useAuth();
  const { canManageBilling } = usePermissions();
  const currentPlan = workspace?.plan || 'free';
  const [history] = useState<CreditTransaction[]>(mockHistory);

  if (!canManageBilling) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-text-muted mb-3" />
        <h2 className="text-lg font-medium text-text-primary mb-1">Admin access required</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          Only workspace admins and owners can view billing and manage plans.
          Contact your workspace admin for changes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current plan + credit balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-sm text-text-muted mb-1">Current Plan</p>
          <p className="text-2xl font-bold text-text-primary capitalize">{currentPlan}</p>
          <p className="text-sm text-text-secondary mt-1">
            {currentPlan === 'free' ? '$0' : currentPlan === 'starter' ? '$19' : '$49'}/month
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-sm text-text-muted mb-1">Credit Balance</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-accent">
              {workspace ? formatCredits(workspace.credit_balance) : '---'}
            </p>
            <Coins className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {plans.find((p) => p.id === currentPlan)?.credits.toLocaleString()} credits/month
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative border rounded-xl p-5 transition-colors',
                  plan.popular
                    ? 'bg-accent/5 border-accent/30'
                    : 'bg-surface border-border',
                  isCurrent && 'ring-1 ring-accent'
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-accent text-white px-2.5 py-0.5 rounded-full">
                    Popular
                  </span>
                )}

                <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2 mb-4">
                  <span className="text-3xl font-bold text-text-primary">${plan.price}</span>
                  <span className="text-text-muted text-sm">/mo</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  className={cn(
                    'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                    isCurrent
                      ? 'bg-surface border border-border text-text-muted cursor-not-allowed'
                      : 'bg-accent hover:bg-accent-hover text-white'
                  )}
                >
                  {isCurrent ? 'Current plan' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage history */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Credit History</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-text-muted text-sm">No credit transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                  <th className="text-right px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-text-primary">{tx.description}</td>
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
                    <td className="px-4 py-3 text-right text-text-muted">
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
