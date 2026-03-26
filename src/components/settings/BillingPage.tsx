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
import { PLAN_TIERS, PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';
import type { UserSubscription, BillingPeriod, SubscriptionStatus, PlanTier } from '@/billing/types/subscriptions';
import { fetchBillingSummary } from '@/billing/hooks/billing-cache';
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
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

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

  const hasSubscription = status === 'active' || status === 'past_due';

  async function openStripePortal() {
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
            onClick={() => { onClose(); setCancelConfirm(false); }}
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

          {/* Stripe Portal actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={openStripePortal}
              disabled={!hasSubscription || portalLoading}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border transition-colors',
                hasSubscription
                  ? 'text-text-primary hover:border-accent/30'
                  : 'text-text-muted cursor-not-allowed'
              )}
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Edit billing info
            </button>
            <button
              onClick={openStripePortal}
              disabled={!hasSubscription || portalLoading}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border transition-colors',
                hasSubscription
                  ? 'text-text-primary hover:border-accent/30'
                  : 'text-text-muted cursor-not-allowed'
              )}
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Invoices & payments
            </button>
          </div>

          {/* Cancel subscription */}
          {hasSubscription && (
            <div className="pt-2 border-t border-border">
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 bg-surface border border-border hover:border-red-500/30 transition-colors"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">
                      Are you sure? Your subscription will remain active until {renewalDate || 'the end of your billing period'}. After that, your monthly credits will stop and only extra credits will remain.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="py-2.5 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors"
                    >
                      Keep subscription
                    </button>
                    <button
                      onClick={openStripePortal}
                      disabled={portalLoading}
                      className="py-2.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {portalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Top Up Credits Modal ───────────────────────────────────

const TIER_KEYS = Object.keys(PLAN_TIERS) as PlanTier[];

const SELECT_ARROW_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 0.75rem center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '1.25em 1.25em',
  paddingRight: '2.5rem',
} as const;

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
  const [loading, setLoading] = useState(false);

  const currentTier = subscription?.plan_tier as PlanTier | undefined;
  const currentTierConfig = currentTier ? PLAN_TIERS[currentTier] : null;
  const billingPeriod = subscription?.billing_period ?? 'monthly';
  const isSubscribed = subscription?.status === 'active' && !!currentTier;

  // Upgrade: find next tier up, allow dropdown to pick any higher tier
  const currentIndex = currentTier ? TIER_KEYS.indexOf(currentTier) : -1;
  const upgradeTiers = isSubscribed
    ? TIER_KEYS.filter((_, i) => i > currentIndex)
    : TIER_KEYS;
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState<PlanTier>(
    upgradeTiers[0] || TIER_KEYS[0]
  );

  // PAYG: use the same tier amounts as subscription
  const [selectedPaygTier, setSelectedPaygTier] = useState<PlanTier>('250');

  if (!open) return null;

  const upgradeTierConfig = PLAN_TIERS[selectedUpgradeTier];
  const currentMonthly = currentTierConfig
    ? (billingPeriod === 'annual' ? currentTierConfig.annualMonthlyPrice : currentTierConfig.monthlyPrice)
    : 0;
  const upgradeMonthly = billingPeriod === 'annual'
    ? upgradeTierConfig.annualMonthlyPrice
    : upgradeTierConfig.monthlyPrice;
  const priceDifference = upgradeMonthly - currentMonthly;
  const additionalCredits = upgradeTierConfig.credits - (currentTierConfig?.credits ?? 0);

  // Annual savings in dollars for upgrade tier
  const annualSavingDollars = Math.round(
    (upgradeTierConfig.monthlyPrice - upgradeTierConfig.annualMonthlyPrice) * 12 / 100
  );

  // PAYG pricing
  const paygCredits = PLAN_TIERS[selectedPaygTier].credits;
  const paygPriceCents = paygCredits * PAYGO_PRICE_PER_CREDIT_CENTS;

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedUpgradeTier, billingPeriod }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handlePaygPurchase() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-payg-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: paygCredits }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Add more credits</h2>
              <p className="text-sm text-text-secondary mt-1">
                Upgrade your plan for better value, or top up credits one time.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors -mt-1 -mr-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-3">
          {/* ── Option 1: Upgrade plan ── */}
          <div
            onClick={() => setMode('upgrade')}
            className={cn(
              'rounded-xl border p-5 cursor-pointer transition-colors',
              mode === 'upgrade'
                ? 'border-accent/40 bg-accent/5'
                : 'border-border hover:border-border/80'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-semibold text-text-primary">Upgrade your plan</p>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                mode === 'upgrade' ? 'border-accent bg-accent' : 'border-border'
              )}>
                {mode === 'upgrade' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Plan info rows */}
            <div className="space-y-1.5 text-sm">
              {currentTierConfig && (
                <div className="flex justify-between text-text-secondary">
                  <span>Current plan</span>
                  <span>{currentTierConfig.credits} credits/mo &middot; {formatDollars(currentMonthly)}/mo</span>
                </div>
              )}
              <div className="flex justify-between text-text-primary">
                <span>Upgrade to</span>
                <span>{upgradeTierConfig.credits} credits/mo &middot; {formatDollars(upgradeMonthly)}/mo</span>
              </div>
            </div>

            {/* Expanded content */}
            {mode === 'upgrade' && (
              <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                {/* Price summary */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-text-primary">{formatDollars(priceDifference)}</span>
                    <span className="text-sm text-text-muted ml-2">due today</span>
                  </div>
                  {billingPeriod === 'monthly' && annualSavingDollars > 0 && (
                    <span className="text-sm font-medium text-accent">
                      Save ${annualSavingDollars}/yr with annual
                    </span>
                  )}
                </div>

                {/* Tier selector */}
                <select
                  value={selectedUpgradeTier}
                  onChange={(e) => setSelectedUpgradeTier(e.target.value as PlanTier)}
                  className="w-full px-3 py-2.5 rounded-lg bg-navy-base border border-border text-text-primary text-sm focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={SELECT_ARROW_STYLE}
                >
                  {upgradeTiers.length === 0 && (
                    <option disabled>You&apos;re on the highest plan</option>
                  )}
                  {upgradeTiers.map((tier) => {
                    const tc = PLAN_TIERS[tier];
                    const addCredits = tc.credits - (currentTierConfig?.credits ?? 0);
                    return (
                      <option key={tier} value={tier}>
                        +{addCredits} additional credits
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* ── Option 2: Top up credits ── */}
          <div
            onClick={() => setMode('topup')}
            className={cn(
              'rounded-xl border p-5 cursor-pointer transition-colors',
              mode === 'topup'
                ? 'border-accent/40 bg-accent/5'
                : 'border-border hover:border-border/80'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-text-primary">Top up credits</p>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                mode === 'topup' ? 'border-accent bg-accent' : 'border-border'
              )}>
                {mode === 'topup' && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-sm text-text-secondary">Purchase credits on demand. Never expire.</p>

            {/* Expanded content */}
            {mode === 'topup' && (
              <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                <select
                  value={selectedPaygTier}
                  onChange={(e) => setSelectedPaygTier(e.target.value as PlanTier)}
                  className="w-full px-3 py-2.5 rounded-lg bg-navy-base border border-border text-text-primary text-sm focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={SELECT_ARROW_STYLE}
                >
                  {TIER_KEYS.map((tier) => {
                    const tc = PLAN_TIERS[tier];
                    const price = ((tc.credits * PAYGO_PRICE_PER_CREDIT_CENTS) / 100).toFixed(2);
                    return (
                      <option key={tier} value={tier}>
                        +{tc.credits} credits &nbsp;&nbsp;&nbsp; ${price}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <button
              onClick={onClose}
              className="py-3 rounded-lg text-sm font-medium bg-surface border border-border text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'upgrade' ? handleUpgrade : handlePaygPurchase}
              disabled={loading || (mode === 'upgrade' && upgradeTiers.length === 0)}
              className={cn(
                'py-3 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors flex items-center justify-center gap-2',
                loading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'upgrade' ? 'Upgrade plan' : `Buy credits`}
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

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [balance, setBalance] = useState(0);
  const [subscriptionBalance, setSubscriptionBalance] = useState(0);
  const [subscriptionPlanCredits, setSubscriptionPlanCredits] = useState(0);
  const [paygoBalance, setPaygoBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  // Single fetch for both subscription + credits via combined endpoint with cache
  useEffect(() => {
    fetchBillingSummary()
      .then((summary) => {
        setSubscription(summary.subscription);
        setBalance(summary.credits.displayBalance ?? 0);
        setSubscriptionBalance(summary.credits.subscription ?? 0);
        setSubscriptionPlanCredits(summary.credits.subscriptionPlanCredits ?? 0);
        setPaygoBalance(summary.credits.paygo ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
          {loading ? (
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
          {loading ? (
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
        {loading ? (
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
