import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track calls to lifecycle handlers
const mockAllocateMonthlyCredits = vi.fn().mockResolvedValue(undefined);
const mockProcessExpiredSubscription = vi.fn().mockResolvedValue(undefined);

vi.mock('@/billing/lifecycle/renewal', () => ({
  allocateMonthlyCredits: (...args: unknown[]) => mockAllocateMonthlyCredits(...args),
}));

vi.mock('@/billing/lifecycle/cancellation', () => ({
  processExpiredSubscription: (...args: unknown[]) => mockProcessExpiredSubscription(...args),
}));

// Mock supabase-admin
const mockSelect = vi.fn();
const mockFrom = vi.fn().mockImplementation(() => ({
  select: mockSelect,
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { processDailyCreditAllocations } from '@/jobs/credit-allocation';

// Helper to build chained query mocks
function chainedQuery(data: unknown[]) {
  return {
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data, error: null }),
    // For the cancellation query path (no lte)
    then: undefined,
  };
}

function chainedQueryDirect(data: unknown[]) {
  // For queries that end at .eq() — expired cancellations
  const mock = {
    eq: vi.fn().mockReturnThis(),
  };
  // The last .eq() in the chain resolves the promise
  let callCount = 0;
  mock.eq.mockImplementation(() => {
    callCount++;
    if (callCount >= 2) {
      // Second .eq() call — resolve
      return Promise.resolve({ data, error: null });
    }
    return mock;
  });
  return mock;
}

describe('processDailyCreditAllocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allocates credits for annual users at allocation day with valid annual_end_date', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    const annualSelect = chainedQuery([
      { user_id: 'annual-1', plan_tier: '250', annual_end_date: futureDate.toISOString(), cancel_at_period_end: false },
    ]);
    const cancelSelect = chainedQueryDirect([]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockAllocateMonthlyCredits).toHaveBeenCalledWith('annual-1', '250');
    expect(results.allocated).toBe(1);
  });

  it('skips annual users with expired annual_end_date', async () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    const annualSelect = chainedQuery([
      { user_id: 'annual-expired', plan_tier: '100', annual_end_date: pastDate.toISOString(), cancel_at_period_end: false },
    ]);
    const cancelSelect = chainedQueryDirect([]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockAllocateMonthlyCredits).not.toHaveBeenCalled();
    expect(results.skipped).toBe(1);
  });

  it('allocates credits for cancelled annual user still in paid period', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    const annualSelect = chainedQuery([
      { user_id: 'cancelled-active', plan_tier: '500', annual_end_date: futureDate.toISOString(), cancel_at_period_end: true },
    ]);
    const cancelSelect = chainedQueryDirect([]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockAllocateMonthlyCredits).toHaveBeenCalledWith('cancelled-active', '500');
    expect(results.allocated).toBe(1);
  });

  it('processes expired cancellation for annual user past annual_end_date', async () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);

    const annualSelect = chainedQuery([]);
    const cancelSelect = chainedQueryDirect([
      { user_id: 'cancel-expired', billing_period: 'annual', annual_end_date: pastDate.toISOString(), current_period_end: null },
    ]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockProcessExpiredSubscription).toHaveBeenCalledWith('cancel-expired');
    expect(results.expired).toBe(1);
  });

  it('processes expired cancellation for monthly user past current_period_end', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const annualSelect = chainedQuery([]);
    const cancelSelect = chainedQueryDirect([
      { user_id: 'monthly-expired', billing_period: 'monthly', annual_end_date: null, current_period_end: pastDate.toISOString() },
    ]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockProcessExpiredSubscription).toHaveBeenCalledWith('monthly-expired');
    expect(results.expired).toBe(1);
  });

  it('does NOT process monthly plan users in the cron (only annual)', async () => {
    // The cron only queries billing_period='annual', so monthly users never appear
    const annualSelect = chainedQuery([]);
    const cancelSelect = chainedQueryDirect([]);

    let selectCall = 0;
    mockSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return annualSelect;
      return cancelSelect;
    });

    const results = await processDailyCreditAllocations();

    expect(mockAllocateMonthlyCredits).not.toHaveBeenCalled();
    expect(results.allocated).toBe(0);
  });
});
