'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Coins,
  ArrowLeft,
  ShieldAlert,
  Calendar,
  ExternalLink,
  Plus,
  Loader2,
  ShoppingCart,
  FileText,
  Download,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { useCreditBalance } from '@/billing/hooks/useCreditBalance';
import { useBillingHistory } from '@/billing/hooks/useBillingHistory';
import { PLAN_TIERS, PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';
import type { UserSubscription, BillingPeriod, SubscriptionStatus } from '@/billing/types/subscriptions';
import PlanSelector from '@/components/billing/PlanSelector';
import PurchaseCreditsModal from '@/components/billing/PurchaseCreditsModal';
import WeeklyUsageSummary from '@/components/billing/WeeklyUsageSummary';

const PAYG_QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500] as const;

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const styles: Record<SubscriptionStatus, string> = {
    active: 'bg-emerald-500/10 text-emerald-400',
    cancelled: 'bg-red-500/10 text-red-400',
    past_due: 'bg-warning/10 text-warning',
    none: 'bg-surface border border-border text-text-muted',
  };

  const labels: Record<SubscriptionStatus, string> = {
    active: 'Active',
    cancelled: 'Cancelled',
    past_due: 'Past Due',
    none: 'No Plan',
  };

  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', styles[status])}>
      {labels[status]}
    </span>
  );
}

export default function BillingPage() {
  const { canManageBilling } = usePermissions();
  const { balance, subscriptionBalance, subscriptionPlanCredits, paygoBalance, loading: balanceLoading } = useCreditBalance();
  const { transactions, invoices, loading: historyLoading, loadMore, hasMore } = useBillingHistory();

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Fetch subscription data
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch('/api/billing/subscription');
        if (res.ok) {
          const data = await res.json();
          setSubscription(data.subscription);
        }
      } catch {
        // ignore
      } finally {
        setSubLoading(false);
      }
    }
    fetchSubscription();
  }, []);

  const status: SubscriptionStatus = subscription?.status ?? 'none';
  const planTier = subscription?.plan_tier;
  const billingPeriod: BillingPeriod = subscription?.billing_period ?? 'monthly';
  const tierConfig = planTier ? PLAN_TIERS[planTier as keyof typeof PLAN_TIERS] : null;

  // Subscription usage progress
  const subscriptionUsed = subscriptionPlanCredits > 0
    ? Math.max(subscriptionPlanCredits - subscriptionBalance, 0)
    : 0;
  const subscriptionUsagePercent = subscriptionPlanCredits > 0
    ? Math.min((subscriptionUsed / subscriptionPlanCredits) * 100, 100)
    : 0;

  // Build plan display name
  const planDisplayName = planTier && tierConfig
    ? `${tierConfig.credits} Credits / ${billingPeriod === 'annual' ? 'Annual' : 'Monthly'}`
    : 'No active plan';

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/create-portal', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  }

  async function handlePaygPurchase(credits: number) {
    try {
      const res = await fetch('/api/billing/create-payg-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
  }

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

      {/* ═══════════════════════════════════════════════════════════
          Section 1: Current Plan Summary
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-text-muted mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-text-primary">{planDisplayName}</p>
                <StatusBadge status={status} />
              </div>
              {status === 'cancelled' && subscription?.current_period_end && (
                <p className="text-sm text-red-400 mt-0.5">
                  Ending {formatDate(subscription.current_period_end)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              {subscription?.current_period_end && status === 'active' && (
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Calendar className="w-4 h-4" />
                  Next renewal: {formatDate(subscription.current_period_end)}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Coins className="w-4 h-4" />
                <span className="font-mono font-medium text-text-primary">{balance}</span> credits remaining
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <a
              href="#plans"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
            >
              Change Plan
            </a>
            {subscription && status !== 'none' && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors flex items-center gap-1.5"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage Subscription
              </button>
            )}
            {status === 'cancelled' && (
              <a
                href="#plans"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                Resubscribe
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 2: Credit Balance Breakdown
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-accent" />
          Credit Balance
        </h2>

        {balanceLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Combined balance */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-accent font-mono">{balance}</span>
              <span className="text-text-secondary">credits</span>
            </div>

            {/* Pool breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-navy-base rounded-lg p-3 border border-border">
                <p className="text-xs text-text-muted mb-0.5">Subscription Pool</p>
                <p className="text-lg font-bold text-text-primary font-mono">{subscriptionBalance}</p>
                {subscription?.next_credit_allocation_date && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Resets {formatDate(subscription.next_credit_allocation_date)}
                  </p>
                )}
              </div>
              <div className="bg-navy-base rounded-lg p-3 border border-border">
                <p className="text-xs text-text-muted mb-0.5">PAYG Pool</p>
                <p className="text-lg font-bold text-text-primary font-mono">{paygoBalance}</p>
                <p className="text-xs text-text-muted mt-0.5">Never expires</p>
              </div>
            </div>

            {/* Subscription progress bar */}
            {subscriptionPlanCredits > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Subscription credits used this cycle</span>
                  <span>{subscriptionUsed}/{subscriptionPlanCredits}</span>
                </div>
                <div className="h-2 bg-border/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      subscriptionUsagePercent > 80 ? 'bg-error' : subscriptionUsagePercent > 50 ? 'bg-warning' : 'bg-accent'
                    )}
                    style={{ width: `${subscriptionUsagePercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 3: PAYG Top-Up
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8" id="topup">
        <h2 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-accent" />
          Buy More Credits
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {PAYG_QUICK_AMOUNTS.map((amount) => {
            const price = ((amount * PAYGO_PRICE_PER_CREDIT_CENTS) / 100).toFixed(2);
            return (
              <button
                key={amount}
                onClick={() => handlePaygPurchase(amount)}
                className="bg-navy-base border border-border rounded-lg p-3 text-center hover:border-accent/40 transition-colors group"
              >
                <p className="text-lg font-bold text-text-primary font-mono group-hover:text-accent transition-colors">
                  {amount}
                </p>
                <p className="text-xs text-text-muted">credits</p>
                <p className="text-sm font-medium text-accent mt-1">${price}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors"
          >
            Custom Amount
          </button>
          <p className="text-xs text-text-muted">
            Top-up credits never expire. Subscribe for better per-credit rates.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 4: Weekly Usage Summaries
          ═══════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <WeeklyUsageSummary />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 5: Credit Addition Log
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            <h3 className="text-base font-medium text-text-primary">Credit Addition Log</h3>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">No transactions yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Credits</th>
                    <th className="text-left px-4 py-3 font-medium">Pool</th>
                    <th className="text-right px-4 py-3 font-medium">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            tx.type === 'signup_bonus' && 'bg-warning/10 text-warning',
                            tx.type === 'subscription_renewal' && 'bg-accent/10 text-accent',
                            tx.type === 'subscription_upgrade' && 'bg-emerald-500/10 text-emerald-400',
                            tx.type === 'paygo_purchase' && 'bg-success/10 text-success',
                            tx.type === 'setup_purchase' && 'bg-blue-500/10 text-blue-400'
                          )}
                        >
                          {tx.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-success">
                        +{tx.credits_added}
                      </td>
                      <td className="px-4 py-3 text-text-secondary capitalize">
                        {tx.pool}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary font-mono">
                        {tx.amount_paid_cents > 0 ? formatCents(tx.amount_paid_cents) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="px-6 py-3 border-t border-border">
                <button
                  onClick={loadMore}
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 6: Invoice History
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-text-muted" />
            <h3 className="text-base font-medium text-text-primary">Invoices</h3>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-text-muted text-sm">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {new Date(inv.created * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {inv.number ?? `Invoice ${inv.id.slice(-8)}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-text-primary">
                      {formatCents(inv.amountPaid)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          inv.status === 'paid' && 'bg-emerald-500/10 text-emerald-400',
                          inv.status === 'open' && 'bg-warning/10 text-warning',
                          inv.status === 'void' && 'bg-surface text-text-muted',
                          inv.status === 'uncollectible' && 'bg-error/10 text-error'
                        )}
                      >
                        {inv.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.invoicePdfUrl ? (
                        <a
                          href={inv.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:text-accent-hover text-xs transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Plan Selector
          ═══════════════════════════════════════════════════════════ */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Choose a Plan</h2>
        {subLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <PlanSelector subscription={subscription} />
        )}
      </div>

      {/* Purchase Credits Modal */}
      <PurchaseCreditsModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
      />
    </div>
  );
}
