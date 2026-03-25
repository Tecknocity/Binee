import { describe, it, expect } from 'vitest';
import { getDisplayBalance, getBalanceBreakdown } from '../balance-calculator';

describe('getDisplayBalance', () => {
  it('floors the combined balance', () => {
    expect(getDisplayBalance({ subscription_balance: 10.7, paygo_balance: 5.3 })).toBe(16);
  });

  it('floors down when decimals are high', () => {
    expect(getDisplayBalance({ subscription_balance: 9.999, paygo_balance: 0.999 })).toBe(10);
  });

  it('returns zero for empty accounts', () => {
    expect(getDisplayBalance({ subscription_balance: 0, paygo_balance: 0 })).toBe(0);
  });

  it('handles PAYG-only accounts', () => {
    expect(getDisplayBalance({ subscription_balance: 0, paygo_balance: 24.5 })).toBe(24);
  });
});

describe('getBalanceBreakdown', () => {
  it('returns both floored and exact values', () => {
    const breakdown = getBalanceBreakdown({
      subscription_balance: 87.4523,
      paygo_balance: 12.7891,
    });

    expect(breakdown.total).toBe(100);
    expect(breakdown.subscriptionCredits).toBe(87);
    expect(breakdown.paygoCredits).toBe(12);
    expect(breakdown.exactSubscription).toBeCloseTo(87.4523, 4);
    expect(breakdown.exactPaygo).toBeCloseTo(12.7891, 4);
  });
});
