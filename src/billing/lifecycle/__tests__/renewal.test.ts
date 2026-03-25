import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLAN_TIERS, CREDIT_ALLOCATION_INTERVAL_DAYS } from '../../config';

// Mock supabase-admin
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { pending_plan_change: null } }),
  }),
});
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_credit_transactions') return { insert: mockInsert };
  if (table === 'user_credit_accounts') return { update: mockUpdate };
  // user_subscriptions — needs both update and select
  return { update: mockUpdate, select: mockSelect };
});

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { allocateMonthlyCredits } from '../renewal';

describe('allocateMonthlyCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { pending_plan_change: null } }),
      }),
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('wipes subscription credits and refills with plan amount (no rollover)', async () => {
    await allocateMonthlyCredits('user-123', '250');

    expect(mockFrom).toHaveBeenCalledWith('user_credit_accounts');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_balance: PLAN_TIERS['250'].credits,
        subscription_plan_credits: PLAN_TIERS['250'].credits,
      }),
    );
  });

  it('advances next_credit_allocation_date by CREDIT_ALLOCATION_INTERVAL_DAYS', async () => {
    const before = new Date();
    await allocateMonthlyCredits('user-123', '100');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    // Check that update was called with a future date
    const updateCall = mockUpdate.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.next_credit_allocation_date !== undefined;
    });
    expect(updateCall).toBeDefined();

    const nextDate = new Date(updateCall![0].next_credit_allocation_date);
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + CREDIT_ALLOCATION_INTERVAL_DAYS - 1);
    expect(nextDate.getTime()).toBeGreaterThan(expectedMin.getTime());
  });

  it('logs a subscription_renewal transaction', async () => {
    await allocateMonthlyCredits('user-123', '500');

    expect(mockFrom).toHaveBeenCalledWith('user_credit_transactions');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription_renewal',
        credits_added: PLAN_TIERS['500'].credits,
        pool: 'subscription',
        amount_paid_cents: 0,
      }),
    );
  });
});
