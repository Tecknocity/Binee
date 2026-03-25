import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { handleDowngrade } from '../downgrade';

describe('handleDowngrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('sets pending_plan_change without changing current tier', async () => {
    await handleDowngrade('user-123', '50');

    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pending_plan_change: '50',
      }),
    );
    // Should NOT include plan_tier in the update
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ plan_tier: expect.anything() }),
    );
  });
});
