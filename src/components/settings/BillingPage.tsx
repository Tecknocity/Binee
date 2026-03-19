'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { Coins, ArrowLeft, ShieldAlert, CreditCard, Calendar, Plus, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCredits } from '@/lib/utils';
import PlanCard from '@/components/settings/PlanCard';
import CreditUsageChart from '@/components/settings/CreditUsageChart';
import MemberUsageTable from '@/components/settings/MemberUsageTable';
import BillingHistory from '@/components/settings/BillingHistory';

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

const creditPacks = [
  { id: 'pack-100', credits: 100, price: 5, label: '100 credits' },
  { id: 'pack-500', credits: 500, price: 20, label: '500 credits', popular: true },
  { id: 'pack-1000', credits: 1000, price: 35, label: '1,000 credits' },
];

export default function BillingPage() {
  const { workspace } = useAuth();
  const { canManageBilling } = usePermissions();
  const currentPlan = workspace?.plan || 'free';
  const planConfig = plans.find((p) => p.id === currentPlan);
  const totalCredits = planConfig?.credits || 100;
  const currentBalance = workspace?.credit_balance ?? 0;
  const usedCredits = Math.max(totalCredits - currentBalance, 0);
  const usagePercent = totalCredits > 0 ? Math.min((usedCredits / totalCredits) * 100, 100) : 0;

  // Compute next renewal date (1st of next month)
  const now = new Date();
  const renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Non-admin access denied
  if (!canManageBilling) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="w-10 h-10 text-text-muted mb-3" />
          <h2 className="text-lg font-medium text-text-primary mb-1">Admin access required</h2>
          <p className="text-sm text-text-secondary max-w-sm">
            Only workspace admins and owners can view billing and manage plans.
            Contact your workspace admin for changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Billing & Usage</h1>
        <p className="text-text-secondary text-sm mt-1">
          Manage your plan, purchase credits, and view usage history
        </p>
      </div>

      {/* Current Plan + Credit Balance + Renewal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Current Plan */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-sm text-text-muted mb-1">Current Plan</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-text-primary capitalize">{currentPlan}</p>
            <span className="text-xs font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full">
              {currentPlan === 'free' ? 'Free' : 'Active'}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {currentPlan === 'free' ? '$0' : currentPlan === 'starter' ? '$19' : '$49'}/month
          </p>
        </div>

        {/* Credit Balance + Usage Bar */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-sm text-text-muted mb-1">Credit Balance</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-accent">
              {workspace ? formatCredits(currentBalance) : '---'}
            </p>
            <Coins className="w-5 h-5 text-accent" />
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>{usedCredits} used</span>
              <span>{totalCredits.toLocaleString()} total</span>
            </div>
            <div className="h-1.5 bg-border/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePercent > 80 ? 'bg-error' : usagePercent > 50 ? 'bg-warning' : 'bg-accent'
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Renewal Date */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <p className="text-sm text-text-muted mb-1">Next Renewal</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-text-secondary" />
            <p className="text-lg font-semibold text-text-primary">
              {renewalDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Credits reset to {totalCredits.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Credit Usage Chart */}
      <div className="mb-8">
        <CreditUsageChart />
      </div>

      {/* Member Usage */}
      <div className="mb-8">
        <MemberUsageTable />
      </div>

      {/* Payment Method placeholder */}
      <div className="mb-8">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-text-muted" />
              <div>
                <h3 className="text-base font-medium text-text-primary">Payment Method</h3>
                <p className="text-sm text-text-muted">No payment method on file</p>
              </div>
            </div>
            <button
              disabled
              className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-muted cursor-not-allowed"
            >
              Add Card
            </button>
          </div>
          <p className="text-xs text-text-muted mt-3">
            Payment processing will be available soon via Stripe integration.
          </p>
        </div>
      </div>

      {/* Buy additional credits */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-accent" />
          Buy Additional Credits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {creditPacks.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                'relative border rounded-xl p-5 transition-colors',
                pack.popular ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border'
              )}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-accent text-white px-2.5 py-0.5 rounded-full">
                  Best value
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-accent" />
                <h3 className="text-base font-semibold text-text-primary">{pack.label}</h3>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-bold text-text-primary">${pack.price}</span>
                <span className="text-text-muted text-sm">one-time</span>
              </div>
              <button
                disabled
                className="w-full py-2 rounded-lg text-sm font-medium bg-accent/50 text-white/70 cursor-not-allowed transition-colors"
              >
                Coming Soon
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === currentPlan} />
          ))}
        </div>
      </div>

      {/* Billing History */}
      <div className="mb-8">
        <BillingHistory />
      </div>
    </div>
  );
}
