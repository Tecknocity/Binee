import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { handlePaymentFailure, handlePaymentRecovery } from '../payment-failure';

describe('handlePaymentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('sets status to past_due', async () => {
    await handlePaymentFailure('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'past_due' }),
    );
  });

  it('does NOT touch credits (non-punitive)', async () => {
    await handlePaymentFailure('user-123');

    expect(mockFrom).not.toHaveBeenCalledWith('user_credit_accounts');
  });
});

describe('handlePaymentRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('restores status to active', async () => {
    await handlePaymentRecovery('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });
});
