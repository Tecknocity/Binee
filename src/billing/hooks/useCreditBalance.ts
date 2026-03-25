'use client';

import { useState, useEffect, useCallback } from 'react';

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
 * Fetches credit balance from GET /api/billing/credits.
 * The `balance` field is Math.floor(subscription + paygo) — the single number
 * the user sees everywhere except the billing-page breakdown.
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
      const res = await fetch('/api/billing/credits');
      if (!res.ok) throw new Error('Failed to fetch credit balance');
      const data = await res.json();

      setBalance(data.displayBalance ?? 0);
      setSubscriptionBalance(data.subscription ?? 0);
      setSubscriptionPlanCredits(data.subscriptionPlanCredits ?? 0);
      setPaygoBalance(data.paygo ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Listen for credit-change events so the badge updates after AI interactions
  useEffect(() => {
    const handler = () => {
      fetchBalance();
    };
    window.addEventListener('binee:credit-change', handler);
    return () => window.removeEventListener('binee:credit-change', handler);
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
