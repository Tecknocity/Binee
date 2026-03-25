import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { handleCancellation, processExpiredSubscription } from '../cancellation';

describe('handleCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('sets cancel_at_period_end to true', async () => {
    await handleCancellation('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ cancel_at_period_end: true }),
    );
  });

  it('does NOT wipe credits immediately', async () => {
    await handleCancellation('user-123');

    // Should not touch user_credit_accounts
    expect(mockFrom).not.toHaveBeenCalledWith('user_credit_accounts');
  });
});

describe('processExpiredSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('wipes subscription credits to zero', async () => {
    await processExpiredSubscription('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_credit_accounts');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_balance: 0,
        subscription_plan_credits: 0,
      }),
    );
  });

  it('resets subscription to none with all fields cleared', async () => {
    await processExpiredSubscription('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'none',
        plan_tier: null,
        billing_period: null,
        cancel_at_period_end: false,
        next_credit_allocation_date: null,
        annual_end_date: null,
        payment_provider_id: null,
      }),
    );
  });

  it('does NOT touch PAYG balance (no paygo_balance in update)', async () => {
    await processExpiredSubscription('user-123');

    // The update to user_credit_accounts should only have subscription fields
    const creditCall = mockUpdate.mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.subscription_balance !== undefined;
    });
    expect(creditCall).toBeDefined();
    expect(creditCall![0]).not.toHaveProperty('paygo_balance');
  });
});
