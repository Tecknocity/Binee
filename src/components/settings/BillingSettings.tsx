'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { Coins, Shield, Calendar, CreditCard } from 'lucide-react';
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

export default function BillingSettings() {
  const { workspace, membership } = useAuth();
  const currentPlan = workspace?.plan || 'free';
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const planConfig = plans.find((p) => p.id === currentPlan);
  const totalCredits = planConfig?.credits || 100;
  const currentBalance = workspace?.credit_balance ?? 0;
  const usedCredits = Math.max(totalCredits - currentBalance, 0);
  const usagePercent = totalCredits > 0 ? Math.min((usedCredits / totalCredits) * 100, 100) : 0;

  const now = new Date();
  const renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Non-admin access denied
  if (!isAdmin) {
    return (
      <div className="bg-surface border border-border rounded-xl p-12 text-center">
        <Shield className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <h2 className="text-lg font-medium text-text-primary mb-1">Access Denied</h2>
        <p className="text-text-secondary text-sm">
          Only workspace admins and owners can view billing information.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Plan + Credit Balance + Renewal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      <CreditUsageChart />

      {/* Member Usage */}
      <MemberUsageTable />

      {/* Payment Method placeholder */}
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

      {/* Plan cards */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === currentPlan} />
          ))}
        </div>
      </div>

      {/* Billing History */}
      <BillingHistory />
    </div>
  );
}
