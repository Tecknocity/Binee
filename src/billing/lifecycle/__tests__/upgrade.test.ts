import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLAN_TIERS } from '../../config';

const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'user_credit_transactions') return { insert: mockInsert };
  return { update: mockUpdate };
});

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { handleUpgrade } from '../upgrade';

describe('handleUpgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockInsert.mockResolvedValue({ error: null });
  });

  it('adds credit difference immediately via atomic RPC', async () => {
    await handleUpgrade('user-123', '100', '250');

    const expected = PLAN_TIERS['250'].credits - PLAN_TIERS['100'].credits;
    expect(mockRpc).toHaveBeenCalledWith('add_subscription_credits', {
      p_user_id: 'user-123',
      p_credits: expected,
    });
  });

  it('updates subscription to new tier and clears pending change', async () => {
    await handleUpgrade('user-123', '100', '250');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_tier: '250',
        pending_plan_change: null,
      }),
    );
  });

  it('logs an upgrade transaction with the credit difference', async () => {
    await handleUpgrade('user-123', '50', '500');

    const diff = PLAN_TIERS['500'].credits - PLAN_TIERS['50'].credits;
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subscription_upgrade',
        credits_added: diff,
        pool: 'subscription',
      }),
    );
  });

  it('throws if downgrading (difference <= 0)', async () => {
    await expect(handleUpgrade('user-123', '250', '100')).rejects.toThrow(
      'Upgrade must be to a higher tier',
    );
  });

  it('throws if same tier', async () => {
    await expect(handleUpgrade('user-123', '100', '100')).rejects.toThrow(
      'Upgrade must be to a higher tier',
    );
  });
});
