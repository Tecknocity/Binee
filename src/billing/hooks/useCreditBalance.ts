'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchBillingSummary, invalidateBillingCache } from './billing-cache';

interface CreditBalanceData {
  balance: number;
  subscriptionBalance: number;
  subscriptionPlanCredits: number;
  paygoBalance: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches credit balance via the cached /api/billing/summary endpoint.
 * The `balance` field is Math.floor(subscription + paygo) — the single number
 * the user sees everywhere except the billing-page breakdown.
 *
 * Uses the billing cache for 30-second TTL and request deduplication,
 * so multiple components (CreditBalance header + BillingPage) share
 * the same fetch.
 */
export function useCreditBalance(): CreditBalanceData {
  const [balance, setBalance] = useState(0);
  const [subscriptionBalance, setSubscriptionBalance] = useState(0);
  const [subscriptionPlanCredits, setSubscriptionPlanCredits] = useState(0);
  const [paygoBalance, setPaygoBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      invalidateBillingCache();
      const summary = await fetchBillingSummary();

      setBalance(summary.credits.displayBalance ?? 0);
      setSubscriptionBalance(summary.credits.subscription ?? 0);
      setSubscriptionPlanCredits(summary.credits.subscriptionPlanCredits ?? 0);
      setPaygoBalance(summary.credits.paygo ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch — uses cache so it's instant if BillingPage already loaded
    fetchBillingSummary()
      .then((summary) => {
        setBalance(summary.credits.displayBalance ?? 0);
        setSubscriptionBalance(summary.credits.subscription ?? 0);
        setSubscriptionPlanCredits(summary.credits.subscriptionPlanCredits ?? 0);
        setPaygoBalance(summary.credits.paygo ?? 0);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Listen for credit-change events so the badge updates after AI interactions
  useEffect(() => {
    const handler = () => {
      fetchBalance();
    };
    window.addEventListener('binee:credit-change', handler);
    return () => window.removeEventListener('binee:credit-change', handler);
  }, [fetchBalance]);

  // Refresh billing data when the tab regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBalance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchBalance]);

  return {
    balance,
    subscriptionBalance,
    subscriptionPlanCredits,
    paygoBalance,
    loading,
    error,
    refetch: fetchBalance,
  };
}
