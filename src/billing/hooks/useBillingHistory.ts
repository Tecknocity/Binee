'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CreditTransaction } from '@/billing/types/credits';

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
}

interface BillingHistoryData {
  transactions: CreditTransaction[];
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

/**
 * Fetches credit transactions (paginated) and Stripe invoices.
 */
export function useBillingHistory(): BillingHistoryData {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Initial fetch — transactions + invoices in parallel
  useEffect(() => {
    async function fetchInitial() {
      try {
        const [txRes, invRes] = await Promise.all([
          fetch(`/api/billing/transactions?limit=${PAGE_SIZE}&offset=0`),
          fetch('/api/billing/invoices?limit=20'),
        ]);

        if (!txRes.ok) throw new Error('Failed to fetch transactions');
        const txData = await txRes.json();
        setTransactions(txData.transactions ?? []);
        setHasMore((txData.transactions?.length ?? 0) >= PAGE_SIZE);
        setOffset(PAGE_SIZE);

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData.invoices ?? []);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    try {
      const res = await fetch(`/api/billing/transactions?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch more transactions');
      const data = await res.json();
      const newTx = data.transactions ?? [];
      setTransactions((prev) => [...prev, ...newTx]);
      setHasMore(newTx.length >= PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [offset, hasMore]);

  return { transactions, invoices, loading, error, loadMore, hasMore };
}

export type { Invoice };
