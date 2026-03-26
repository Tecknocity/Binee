import type { UserSubscription } from '@/billing/types/subscriptions';

/**
 * Client-side billing data cache with TTL and request deduplication.
 *
 * Follows the same pattern as the dashboard query cache in useDashboard.ts.
 * - 30-second TTL so repeat navigations to billing show data instantly
 * - Request deduplication prevents multiple components from firing the
 *   same fetch (e.g. CreditBalance header + BillingPage body)
 * - `invalidate()` for credit-change events that need fresh data
 */

const CACHE_TTL = 30_000; // 30 seconds

export interface BillingSummary {
  credits: {
    displayBalance: number;
    subscription: number;
    subscriptionPlanCredits: number;
    paygo: number;
  };
  subscription: UserSubscription | null;
}

interface CacheEntry {
  data: BillingSummary;
  timestamp: number;
}

let cache: CacheEntry | null = null;
let inflightPromise: Promise<BillingSummary> | null = null;

async function doFetch(): Promise<BillingSummary> {
  const res = await fetch('/api/billing/summary');
  if (!res.ok) {
    throw new Error('Failed to fetch billing summary');
  }
  return res.json();
}

/**
 * Fetch billing summary with caching and request deduplication.
 * Multiple concurrent callers receive the same promise.
 */
export async function fetchBillingSummary(): Promise<BillingSummary> {
  // Return cached data if still fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  // Deduplicate in-flight requests
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = doFetch()
    .then((data) => {
      cache = { data, timestamp: Date.now() };
      inflightPromise = null;
      return data;
    })
    .catch((err) => {
      inflightPromise = null;
      throw err;
    });

  return inflightPromise;
}

/**
 * Invalidate the cache so the next call fetches fresh data.
 * Call this after credit-changing operations (AI interactions, purchases).
 */
export function invalidateBillingCache(): void {
  cache = null;
}
