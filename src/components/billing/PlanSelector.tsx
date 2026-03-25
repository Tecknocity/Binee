'use client';

import { useState } from 'react';
import { Check, Loader2, Crown } from 'lucide-react';
import { PLAN_TIERS } from '@/billing/config';
import type { BillingPeriod, UserSubscription } from '@/billing/types/subscriptions';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  subscription: UserSubscription | null;
}

type TierKey = keyof typeof PLAN_TIERS;

const TIER_ORDER: TierKey[] = ['50', '100', '250', '500', '1000'];
const RECOMMENDED_TIER: TierKey = '250';

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function formatCentsDecimal(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getButtonState(
  tierKey: TierKey,
  billingPeriod: BillingPeriod,
  subscription: UserSubscription | null,
): { label: string; disabled: boolean; action: 'subscribe' | 'upgrade' | 'downgrade' | 'switch' | 'current' } {
  if (!subscription || subscription.status === 'none' || !subscription.plan_tier) {
    return { label: 'Subscribe', disabled: false, action: 'subscribe' };
  }

  const currentTier = subscription.plan_tier;
  const currentPeriod = subscription.billing_period;

  if (tierKey === currentTier && billingPeriod === currentPeriod) {
    return { label: 'Current Plan', disabled: true, action: 'current' };
  }

  if (tierKey === currentTier && billingPeriod !== currentPeriod) {
    const periodLabel = billingPeriod === 'annual' ? 'Annual' : 'Monthly';
    return { label: `Switch to ${periodLabel}`, disabled: false, action: 'switch' };
  }

  const currentCredits = PLAN_TIERS[currentTier as TierKey]?.credits ?? 0;
  const targetCredits = PLAN_TIERS[tierKey].credits;

  if (targetCredits > currentCredits) {
    return { label: 'Upgrade', disabled: false, action: 'upgrade' };
  }

  return { label: 'Downgrade', disabled: false, action: 'downgrade' };
}

export default function PlanSelector({ subscription }: PlanSelectorProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    subscription?.billing_period ?? 'monthly'
  );
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState<TierKey | null>(null);

  async function handleSelectPlan(tierKey: TierKey, action: string) {
    if (action === 'current') return;

    if (action === 'downgrade' && confirmDowngrade !== tierKey) {
      setConfirmDowngrade(tierKey);
      return;
    }

    setLoadingTier(tierKey);
    setConfirmDowngrade(null);

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierKey, billingPeriod }),
      });

      if (!res.ok) throw new Error('Failed to create checkout');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Error is handled by the API route
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div id="plans">
      {/* Billing period toggle */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex items-center rounded-lg bg-surface border border-border p-1">
          <button
            onClick={() => { setBillingPeriod('monthly'); setConfirmDowngrade(null); }}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              billingPeriod === 'monthly'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => { setBillingPeriod('annual'); setConfirmDowngrade(null); }}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              billingPeriod === 'annual'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            Annual <span className="text-xs opacity-75">(Save ~17%)</span>
          </button>
        </div>
      </div>

      {/* Plan tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {TIER_ORDER.map((tierKey) => {
          const tier = PLAN_TIERS[tierKey];
          const isRecommended = tierKey === RECOMMENDED_TIER;
          const { label, disabled, action } = getButtonState(tierKey, billingPeriod, subscription);
          const isLoading = loadingTier === tierKey;

          const monthlyPrice = billingPeriod === 'monthly'
            ? tier.monthlyPrice
            : tier.annualMonthlyPrice;
          const annualTotal = tier.annualMonthlyPrice * 12;
          const pricePerCredit = monthlyPrice / tier.credits;

          return (
            <div
              key={tierKey}
              className={cn(
                'relative border rounded-xl p-5 transition-colors flex flex-col',
                isRecommended ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border',
                action === 'current' && 'ring-1 ring-accent'
              )}
            >
              {/* Badges */}
              {isRecommended && action !== 'current' && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-accent text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              )}
              {action === 'current' && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-emerald-500 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Current Plan
                </span>
              )}

              {/* Credit amount */}
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-accent" />
                <span className="text-2xl font-bold text-text-primary font-mono">
                  {tier.credits}
                </span>
              </div>
              <p className="text-sm text-text-muted mb-4">credits / month</p>

              {/* Price */}
              <div className="mb-1">
                <span className="text-xl font-bold text-text-primary">
                  {formatCents(monthlyPrice)}
                </span>
                <span className="text-text-muted text-sm">/mo</span>
              </div>

              {billingPeriod === 'annual' && (
                <p className="text-xs text-text-muted mb-2">
                  {formatCents(annualTotal)}/yr billed annually
                </p>
              )}

              {/* Per-credit rate */}
              <p className="text-xs text-text-secondary mb-4">
                {formatCentsDecimal(pricePerCredit)}/credit
              </p>

              <div className="mt-auto">
                {/* Downgrade confirmation */}
                {confirmDowngrade === tierKey && (
                  <div className="mb-3 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-xs text-warning">
                      You&apos;ll switch to {tier.credits} credits at your next billing date.
                      You keep your current credits until then.
                    </p>
                  </div>
                )}

                <button
                  disabled={disabled || isLoading}
                  onClick={() => handleSelectPlan(tierKey, action)}
                  className={cn(
                    'w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    disabled
                      ? 'bg-surface border border-border text-text-muted cursor-not-allowed'
                      : action === 'downgrade'
                        ? 'bg-surface border border-border text-text-primary hover:border-warning/50 hover:text-warning'
                        : 'bg-accent hover:bg-accent-hover text-white'
                  )}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmDowngrade === tierKey ? 'Confirm Downgrade' : label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
