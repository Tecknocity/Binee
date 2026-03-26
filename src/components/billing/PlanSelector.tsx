'use client';

import { useState } from 'react';
import { Check, Loader2, CircleCheck } from 'lucide-react';
import { PLAN_TIERS, PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';
import type { BillingPeriod, UserSubscription } from '@/billing/types/subscriptions';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  subscription: UserSubscription | null;
}

type TierKey = keyof typeof PLAN_TIERS;

const TIER_ORDER: TierKey[] = ['100', '150', '250', '500', '750', '1000', '2000'];

// PAYG uses same credit amounts as subscription tiers
const PAYG_AMOUNTS = TIER_ORDER;

function formatDollars(cents: number): string {
  const val = cents / 100;
  return val % 1 === 0 ? `$${val}` : `$${val.toFixed(2)}`;
}

const SELECT_ARROW_SVG = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

const SHARED_FEATURES = [
  'All AI models (Haiku, Sonnet, Opus)',
  'Full health monitoring',
  'Custom dashboards',
];

// ── Monthly Subscription Card ──────────────────────────────

function SubscriptionCard({ subscription }: { subscription: UserSubscription | null }) {
  const currentTier = subscription?.plan_tier as TierKey | undefined;
  const currentPeriod = subscription?.billing_period ?? 'monthly';
  const isActive = subscription?.status === 'active';

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(currentPeriod);
  const [selectedTier, setSelectedTier] = useState<TierKey>(currentTier || '250');
  const [loading, setLoading] = useState(false);

  const tierConfig = PLAN_TIERS[selectedTier];
  const monthlyPrice = billingPeriod === 'monthly'
    ? tierConfig.monthlyPrice
    : tierConfig.annualMonthlyPrice;

  // Annual savings = (monthly price * 12) - (annual price * 12)
  const annualSavingsCents = (tierConfig.monthlyPrice - tierConfig.annualMonthlyPrice) * 12;
  const annualSavingsDollars = Math.round(annualSavingsCents / 100);

  const isCurrent = isActive && currentTier === selectedTier && currentPeriod === billingPeriod;
  const isSubscribed = isActive && !!currentTier;

  async function handleSubscribe() {
    if (isCurrent) return;
    setLoading(true);

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedTier, billingPeriod }),
      });

      if (!res.ok) throw new Error('Failed to create checkout');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  // Button label
  let buttonLabel = 'Subscribe';
  if (isCurrent) {
    buttonLabel = 'Current plan';
  } else if (isActive && currentTier) {
    const currentCredits = PLAN_TIERS[currentTier]?.credits ?? 0;
    if (tierConfig.credits > currentCredits) {
      buttonLabel = 'Upgrade';
    } else if (tierConfig.credits < currentCredits) {
      buttonLabel = 'Downgrade';
    } else {
      buttonLabel = billingPeriod === 'annual' ? 'Switch to Annual' : 'Switch to Monthly';
    }
  }

  return (
    <div className="relative bg-surface border border-border rounded-xl p-6 flex flex-col">
      {/* Current badge */}
      {isSubscribed && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CircleCheck className="w-3 h-3" />
            Current
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Monthly Subscription</h3>
        <p className="text-sm text-text-secondary mt-0.5">
          Best value for regular usage. Credits refresh every month.
        </p>
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-text-primary">{formatDollars(monthlyPrice)}</span>
          <span className="text-text-muted text-sm">per month</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5">shared across all workspace members</p>
      </div>

      {/* Annual toggle */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setBillingPeriod(billingPeriod === 'annual' ? 'monthly' : 'annual')}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
            billingPeriod === 'annual' ? 'bg-accent' : 'bg-border'
          )}
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
              billingPeriod === 'annual' ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
        <span className="text-sm text-text-secondary">Annual</span>
        {billingPeriod === 'annual' && annualSavingsDollars > 0 && (
          <span className="text-sm font-medium text-emerald-400">
            Save ${annualSavingsDollars}
          </span>
        )}
      </div>

      {/* Subscribe / Upgrade button */}
      <button
        onClick={handleSubscribe}
        disabled={isCurrent || loading}
        className={cn(
          'w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-5',
          isCurrent
            ? 'bg-accent text-white cursor-default'
            : 'bg-accent hover:bg-accent-hover text-white',
          loading && 'opacity-70 cursor-not-allowed'
        )}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {buttonLabel}
      </button>

      {/* Tier dropdown */}
      <div className="mb-5">
        <select
          value={selectedTier}
          onChange={(e) => setSelectedTier(e.target.value as TierKey)}
          className="w-full px-3 py-2.5 rounded-lg bg-navy-base border border-border text-text-primary text-sm focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
          style={{ backgroundImage: SELECT_ARROW_SVG, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
        >
          {TIER_ORDER.map((tier) => {
            const isCurrentTier = isActive && currentTier === tier && currentPeriod === billingPeriod;
            return (
              <option key={tier} value={tier}>
                {PLAN_TIERS[tier].credits} credits / month{isCurrentTier ? '  ·  Current' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Features */}
      <div className="space-y-2 mt-auto">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Includes:</p>
        {[
          `${tierConfig.credits} monthly credits`,
          'Shared workspace credits',
          ...SHARED_FEATURES,
          'On-demand credit top-ups',
          'Priority support',
        ].map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pay-as-you-go Card ─────────────────────────────────────

function PayAsYouGoCard({ subscription }: { subscription: UserSubscription | null }) {
  const isSubscribed = subscription?.status === 'active' && !!subscription?.plan_tier;
  const [selectedAmount, setSelectedAmount] = useState<TierKey>('250');
  const [loading, setLoading] = useState(false);

  const credits = PLAN_TIERS[selectedAmount].credits;
  const totalPrice = credits * PAYGO_PRICE_PER_CREDIT_CENTS;

  async function handleBuyCredits() {
    setLoading(true);
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
      // handled
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative bg-surface border border-border rounded-xl p-6 flex flex-col">
      {/* Current badge (only if no subscription) */}
      {!isSubscribed && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CircleCheck className="w-3 h-3" />
            Current
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Pay-as-you-go</h3>
        <p className="text-sm text-text-secondary mt-0.5">
          Purchase credits when you need them. No commitment.
        </p>
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-text-primary">
            ${(PAYGO_PRICE_PER_CREDIT_CENTS / 100).toFixed(2)}
          </span>
          <span className="text-text-muted text-sm">per credit</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5">shared across all workspace members</p>
      </div>

      {/* Spacer to match annual toggle height */}
      <div className="h-5 mb-5" />

      {/* Buy button */}
      <button
        onClick={handleBuyCredits}
        disabled={loading}
        className={cn(
          'w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-5',
          'bg-accent hover:bg-accent-hover text-white',
          loading && 'opacity-70 cursor-not-allowed'
        )}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Buy Extra Credits
      </button>

      {/* Amount dropdown */}
      <div className="mb-5">
        <select
          value={selectedAmount}
          onChange={(e) => setSelectedAmount(e.target.value as TierKey)}
          className="w-full px-3 py-2.5 rounded-lg bg-navy-base border border-border text-text-primary text-sm focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
          style={{ backgroundImage: SELECT_ARROW_SVG, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
        >
          {PAYG_AMOUNTS.map((tier) => {
            const amt = PLAN_TIERS[tier].credits;
            const price = ((amt * PAYGO_PRICE_PER_CREDIT_CENTS) / 100).toFixed(2);
            return (
              <option key={tier} value={tier}>
                {amt} credits · ${price}
              </option>
            );
          })}
        </select>
      </div>

      {/* Features */}
      <div className="space-y-2 mt-auto">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Includes:</p>
        {[
          'Credits never expire',
          'Shared workspace credits',
          ...SHARED_FEATURES,
          'No monthly commitment',
          'On-demand purchases',
        ].map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────────

export default function PlanSelector({ subscription }: PlanSelectorProps) {
  return (
    <div id="plans" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SubscriptionCard subscription={subscription} />
      <PayAsYouGoCard subscription={subscription} />
    </div>
  );
}
