import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SETUP_FEE_CENTS, SETUP_CREDITS } from '../../config';

const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_credit_transactions') return { insert: mockInsert };
  return {};
});

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { handleSetupPurchase } from '../setup-purchase';

describe('handleSetupPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('adds SETUP_CREDITS to PAYG pool via atomic RPC', async () => {
    await handleSetupPurchase('user-123');

    expect(mockRpc).toHaveBeenCalledWith('add_paygo_credits', {
      p_user_id: 'user-123',
      p_credits: SETUP_CREDITS,
    });
  });

  it('logs a setup_purchase transaction with correct amount', async () => {
    await handleSetupPurchase('user-123');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setup_purchase',
        credits_added: SETUP_CREDITS,
        pool: 'paygo',
        amount_paid_cents: SETUP_FEE_CENTS,
      }),
    );
  });

  it('throws if RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'RPC failed' } });
    await expect(handleSetupPurchase('user-123')).rejects.toThrow('Failed to add setup credits');
  });
});
