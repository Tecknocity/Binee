import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FREE_SIGNUP_CREDITS } from '../../config';

// Mock supabase-admin
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_credit_transactions') {
    return { insert: mockInsert };
  }
  return { upsert: mockUpsert };
});

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { handleSignup } from '../signup';

describe('handleSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('creates credit account with FREE_SIGNUP_CREDITS in PAYG pool', async () => {
    await handleSignup('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_credit_accounts');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        subscription_balance: 0,
        subscription_plan_credits: 0,
        paygo_balance: FREE_SIGNUP_CREDITS,
      }),
      expect.objectContaining({ onConflict: 'user_id', ignoreDuplicates: true }),
    );
  });

  it('creates subscription record with status "none"', async () => {
    await handleSignup('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        status: 'none',
      }),
      expect.objectContaining({ onConflict: 'user_id', ignoreDuplicates: true }),
    );
  });

  it('logs a signup_bonus transaction for PAYG pool', async () => {
    await handleSignup('user-123');

    expect(mockFrom).toHaveBeenCalledWith('user_credit_transactions');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        type: 'signup_bonus',
        credits_added: FREE_SIGNUP_CREDITS,
        pool: 'paygo',
        amount_paid_cents: 0,
      }),
    );
  });

  it('throws if credit account creation fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB error' } });
    await expect(handleSignup('user-123')).rejects.toThrow('Failed to create credit account');
  });
});
