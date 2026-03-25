'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Coins,
  ShieldAlert,
  Check,
  Loader2,
  X,
  ExternalLink,
  FileText,
  CreditCard,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useCreditBalance } from '@/billing/hooks/useCreditBalance';
import { PLAN_TIERS, PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';
import type { UserSubscription, BillingPeriod, SubscriptionStatus, PlanTier } from '@/billing/types/subscriptions';
import PlanSelector from '@/components/billing/PlanSelector';
import WeeklyUsageSummary from '@/components/billing/WeeklyUsageSummary';
import MemberUsageTable from '@/components/settings/MemberUsageTable';

// ── Helpers ────────────────────────────────────────────────

function formatDollars(cents: number): string {
  const val = cents / 100;
  return val % 1 === 0 ? `$${val}` : `$${val.toFixed(2)}`;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Manage Plan Modal ──────────────────────────────────────

function ManagePlanModal({
  open,
  onClose,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  subscription: UserSubscription | null;
}) {
  if (!open) return null;

  const status = subscription?.status ?? 'none';
  const planTier = subscription?.plan_tier;
  const tierConfig = planTier ? PLAN_TIERS[planTier as keyof typeof PLAN_TIERS] : null;
  const billingPeriod = subscription?.billing_period ?? 'monthly';
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;

  const planLabel = tierConfig
    ? `${tierConfig.credits} Credits / ${billingPeriod === 'annual' ? 'Annual' : 'Monthly'}`
    : 'No active plan';

  // Stripe portal links — placeholders for now
  const handleEditBilling = () => {
    // TODO: Connect to Stripe Customer Portal (billing info section)
    window.open('#stripe-billing-info', '_blank');
  };

  const handleInvoices = () => {
    // TODO: Connect to Stripe Customer Portal (invoices section)
    window.open('#stripe-invoices', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Manage plan</h2>
            <p className="text-sm text-text-secondary">Subscription & billing settings</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Current plan row */}
          <div className="flex items-center justify-between p-3 bg-navy-base rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  You&apos;re on {status !== 'none' ? planLabel : 'Pay-as-you-go'}
                </p>
                {renewalDate && status === 'active' && (
                  <p className="text-xs text-text-muted">Renews {renewalDate}</p>
                )}
                {status === 'cancelled' && subscription?.current_period_end && (
                  <p className="text-xs text-red-400">Ending {renewalDate}</p>
                )}
                {status === 'none' && (
                  <p className="text-xs text-text-muted">No active subscription</p>
                )}
              </div>
            </div>
            {status === 'active' && (
              <a
                href="#plans"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
              >
                Change plan
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleEditBilling}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Edit billing information
            </button>
            <button
              onClick={handleInvoices}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Invoices & payments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top Up Credits Modal ───────────────────────────────────

function TopUpCreditsModal({
  open,
  onClose,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  subscription: UserSubscription | null;
}) {
  const [mode, setMode] = useState<'upgrade' | 'topup'>('upgrade');
  const [selectedPaygAmount, setSelectedPaygAmount] = useState(100);

  if (!open) return null;

  const currentTier = subscription?.plan_tier;
  const currentTierConfig = currentTier ? PLAN_TIERS[currentTier as keyof typeof PLAN_TIERS] : null;
  const billingPeriod = subscription?.billing_period ?? 'monthly';

  // Find the next tier up for upgrade suggestion
  const tierKeys = Object.keys(PLAN_TIERS) as PlanTier[];
  const currentIndex = currentTier ? tierKeys.indexOf(currentTier) : -1;
  const nextTier = currentIndex >= 0 && currentIndex < tierKeys.length - 1
    ? tierKeys[currentIndex + 1]
    : tierKeys[0];
  const nextTierConfig = PLAN_TIERS[nextTier];
  const nextTierMonthlyPrice = billingPeriod === 'annual'
    ? nextTierConfig.annualMonthlyPrice
    : nextTierConfig.monthlyPrice;

  // Compute difference for "due today" (prorated placeholder)
  const currentMonthly = currentTierConfig
    ? (billingPeriod === 'annual' ? currentTierConfig.annualMonthlyPrice : currentTierConfig.monthlyPrice)
    : 0;
  const priceDifference = nextTierMonthlyPrice - currentMonthly;
  const additionalCredits = nextTierConfig.credits - (currentTierConfig?.credits ?? 0);

  // PAYG amounts
  const PAYG_OPTIONS = [50, 100, 250, 500] as const;
  const paygPrice = ((selectedPaygAmount * PAYGO_PRICE_PER_CREDIT_CENTS) / 100).toFixed(2);

  // Annual savings for the upgrade suggestion
  const annualSaving = nextTierConfig
    ? (nextTierConfig.monthlyPrice - nextTierConfig.annualMonthlyPrice) * 12 / 100
    : 0;

  async function handleUpgrade() {
    // TODO: Connect to Stripe checkout for upgrade
    onClose();
  }

  async function handlePaygPurchase() {
    try {
      const res = await fetch('/api/billing/create-payg-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: selectedPaygAmount }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Add more credits</h2>
            <p className="text-sm text-text-secondary">Upgrade your plan for better value, or top up credits one time.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Option 1: Upgrade plan */}
          <button
            onClick={() => setMode('upgrade')}
            className={cn(
              'w-full text-left rounded-xl border p-4 transition-colors',
              mode === 'upgrade'
                ? 'border-accent/40 bg-accent/5'
                : 'border-border hover:border-border/80'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Upgrade your plan</p>
              </div>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                mode === 'upgrade' ? 'border-accent bg-accent' : 'border-border'
              )}>
                {mode === 'upgrade' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            <div className="space-y-1 text-xs text-text-secondary">
              {currentTierConfig && (
                <div className="flex justify-between">
                  <span>Current plan</span>
                  <span>{currentTierConfig.credits} credits/mo &middot; {formatDollars(currentMonthly)}/mo</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Upgrade to</span>
                <span>{nextTierConfig.credits} credits/mo &middot; {formatDollars(nextTierMonthlyPrice)}/mo</span>
              </div>
            </div>

            {mode === 'upgrade' && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold text-text-primary">{formatDollars(priceDifference)}</span>
                    <span className="text-xs text-text-muted ml-1.5">due today</span>
                  </div>
                  {billingPeriod === 'monthly' && annualSaving > 0 && (
                    <span className="text-xs font-medium text-emerald-400">
                      Subscribe & save {Math.round(((nextTierConfig.monthlyPrice - nextTierConfig.annualMonthlyPrice) / nextTierConfig.monthlyPrice) * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">+{additionalCredits} additional credits</p>
              </div>
            )}
          </button>

          {/* Option 2: Top up credits */}
          <button
            onClick={() => setMode('topup')}
            className={cn(
              'w-full text-left rounded-xl border p-4 transition-colors',
              mode === 'topup'
                ? 'border-accent/40 bg-accent/5'
                : 'border-border hover:border-border/80'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-text-primary">Top up credits</p>
                <p className="text-xs text-text-secondary">Purchase credits on demand. Never expire.</p>
              </div>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                mode === 'topup' ? 'border-accent bg-accent' : 'border-border'
              )}>
                {mode === 'topup' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {mode === 'topup' && (
              <div className="mt-2 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-4 gap-2">
                  {PAYG_OPTIONS.map((amount) => (
                    <button
                      key={amount}
                      onClick={(e) => { e.stopPropagation(); setSelectedPaygAmount(amount); }}
                      className={cn(
                        'py-2 rounded-lg text-sm font-medium border transition-colors',
                        selectedPaygAmount === amount
                          ? 'bg-accent/10 border-accent/40 text-accent'
                          : 'bg-surface border-border text-text-secondary hover:border-accent/30'
                      )}
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-text-muted">
                    {selectedPaygAmount} credits &times; ${(PAYGO_PRICE_PER_CREDIT_CENTS / 100).toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-text-primary font-mono">${paygPrice}</span>
                </div>
              </div>
            )}
          </button>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'upgrade' ? handleUpgrade : handlePaygPurchase}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
            >
              {mode === 'upgrade' ? 'Upgrade plan' : `Buy ${selectedPaygAmount} credits`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main BillingPage Component ─────────────────────────────

export default function BillingPage() {
  const { canManageBilling } = usePermissions();
  const { balance, subscriptionBalance, subscriptionPlanCredits, paygoBalance, loading: balanceLoading } = useCreditBalance();

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

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

  // Credit breakdown
  const creditsRemaining = balance;
  const subscriptionCreditsRemaining = subscriptionBalance;
  const paygoCreditsRemaining = paygoBalance;

  // Progress bar
  const totalPlanCredits = subscriptionPlanCredits || (tierConfig?.credits ?? 0);
  const creditUsagePercent = totalPlanCredits > 0
    ? Math.min(((totalPlanCredits - subscriptionCreditsRemaining) / totalPlanCredits) * 100, 100)
    : (status === 'none' ? 0 : 100);

  // Renewal info
  const renewalDateStr = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null;
  const daysToRenewal = subscription?.next_credit_allocation_date
    ? daysUntil(subscription.next_credit_allocation_date)
    : null;

  // Plan display
  const planLabel = tierConfig
    ? `${tierConfig.credits} Credits`
    : 'Pay-as-you-go';
  const planPeriodLabel = tierConfig
    ? billingPeriod === 'annual' ? 'Annual' : 'Monthly'
    : null;

  // Non-admin access denied
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
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Plans & credits</h2>
        <p className="text-sm text-text-secondary">Manage your subscription plan and credit balance.</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Top Row: Plan Summary (left) + Credits Remaining (right)
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Current Plan */}
        <div className="bg-surface border border-border rounded-xl p-6">
          {subLoading ? (
            <div className="flex items-center justify-center h-[140px]">
              <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-text-primary font-medium">
                  You&apos;re on {status !== 'none' ? `${planLabel} plan` : 'Pay-as-you-go'}
                </p>
                {renewalDateStr && status === 'active' && (
                  <p className="text-xs text-text-muted mt-0.5">Renews {renewalDateStr}</p>
                )}
                {status === 'cancelled' && subscription?.current_period_end && (
                  <p className="text-xs text-red-400 mt-0.5">Ending {renewalDateStr}</p>
                )}
                {status === 'none' && (
                  <p className="text-xs text-text-muted mt-0.5">Subscribe for better per-credit rates</p>
                )}
              </div>

              {tierConfig && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {tierConfig.credits} monthly credits
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Shared across all workspace members
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    On-demand credit top-ups
                  </div>
                </div>
              )}

              {!tierConfig && (
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {paygoCreditsRemaining} credits available
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Credits never expire
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowManageModal(true)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors"
                >
                  Manage
                </button>
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:border-accent/30 transition-colors"
                >
                  Top up credits
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Credits Remaining */}
        <div className="bg-surface border border-border rounded-xl p-6">
          {balanceLoading ? (
            <div className="flex items-center justify-center h-[140px]">
              <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
            </div>
          ) : (
            <>
              {/* Header with total */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-accent">Credits remaining</p>
                <p className="text-2xl font-bold text-text-primary font-mono">{creditsRemaining}</p>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-border/50 rounded-full overflow-hidden mb-5">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    creditUsagePercent > 80 ? 'bg-red-500' : creditUsagePercent > 50 ? 'bg-yellow-500' : 'bg-accent'
                  )}
                  style={{ width: `${100 - creditUsagePercent}%` }}
                />
              </div>

              {/* Breakdown rows */}
              <div className="space-y-3">
                {/* Subscription credits */}
                {totalPlanCredits > 0 && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">Monthly credits</p>
                      <p className="text-xs text-text-muted">
                        {daysToRenewal !== null
                          ? `Resets to ${totalPlanCredits} in ${daysToRenewal} days`
                          : `${totalPlanCredits} per cycle`}
                      </p>
                    </div>
                    <p className="text-base font-bold text-text-primary font-mono">
                      {subscriptionCreditsRemaining}
                    </p>
                  </div>
                )}

                {/* Extra / PAYG credits */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Extra credits</p>
                    <p className="text-xs text-text-muted">Never expire</p>
                  </div>
                  <p className="text-base font-bold text-text-primary font-mono">
                    {paygoCreditsRemaining}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Plan Cards: Monthly Subscription + Pay-as-you-go
          ═══════════════════════════════════════════════════════════ */}
      <div className="mb-2">
        {subLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <PlanSelector subscription={subscription} />
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Weekly Usage
          ═══════════════════════════════════════════════════════════ */}
      <WeeklyUsageSummary />

      {/* ═══════════════════════════════════════════════════════════
          Usage Per Member
          ═══════════════════════════════════════════════════════════ */}
      <MemberUsageTable />

      {/* ── Modals ── */}
      <ManagePlanModal
        open={showManageModal}
        onClose={() => setShowManageModal(false)}
        subscription={subscription}
      />
      <TopUpCreditsModal
        open={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        subscription={subscription}
      />
    </div>
  );
}
