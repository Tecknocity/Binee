import { describe, it, expect } from 'vitest';
import { calculateDeduction } from '../credit-deduction';

describe('calculateDeduction', () => {
  it('deducts from subscription only when sufficient', () => {
    const result = calculateDeduction(
      { subscription_balance: 10, paygo_balance: 5 },
      3,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBe(3);
    expect(result.fromPaygo).toBe(0);
    expect(result.newSubscriptionBalance).toBe(7);
    expect(result.newPaygoBalance).toBe(5);
    expect(result.overageBlocked).toBe(false);
  });

  it('spans both pools when subscription insufficient (2.3 sub, 5.1 deduction)', () => {
    const result = calculateDeduction(
      { subscription_balance: 2.3, paygo_balance: 10 },
      5.1,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBeCloseTo(2.3, 6);
    expect(result.fromPaygo).toBeCloseTo(2.8, 6);
    expect(result.newSubscriptionBalance).toBeCloseTo(0, 6);
    expect(result.newPaygoBalance).toBeCloseTo(7.2, 6);
    expect(result.overageBlocked).toBe(false);
  });

  it('both pools near zero (0.1 sub, 0.2 PAYG, deduct 0.5)', () => {
    const result = calculateDeduction(
      { subscription_balance: 0.1, paygo_balance: 0.2 },
      0.5,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBeCloseTo(0.1, 6);
    expect(result.fromPaygo).toBeCloseTo(0.2, 6);
    // User goes into slight overage (0.2 credits)
    expect(result.newSubscriptionBalance).toBeCloseTo(0, 6);
    expect(result.newPaygoBalance).toBeCloseTo(0, 6);
    expect(result.overageBlocked).toBe(false);
  });

  it('PAYG only, no subscription (free tier user)', () => {
    const result = calculateDeduction(
      { subscription_balance: 0, paygo_balance: 25 },
      3.5,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBe(0);
    expect(result.fromPaygo).toBeCloseTo(3.5, 6);
    expect(result.newSubscriptionBalance).toBe(0);
    expect(result.newPaygoBalance).toBeCloseTo(21.5, 6);
    expect(result.overageBlocked).toBe(false);
  });

  it('subscription only, no PAYG', () => {
    const result = calculateDeduction(
      { subscription_balance: 50, paygo_balance: 0 },
      8,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBe(8);
    expect(result.fromPaygo).toBe(0);
    expect(result.newSubscriptionBalance).toBe(42);
    expect(result.newPaygoBalance).toBe(0);
    expect(result.overageBlocked).toBe(false);
  });

  it('zero credits in both pools blocks deduction', () => {
    const result = calculateDeduction(
      { subscription_balance: 0, paygo_balance: 0 },
      1,
    );

    expect(result.success).toBe(false);
    expect(result.fromSubscription).toBe(0);
    expect(result.fromPaygo).toBe(0);
    expect(result.newSubscriptionBalance).toBe(0);
    expect(result.newPaygoBalance).toBe(0);
    expect(result.overageBlocked).toBe(true);
  });

  it('negative total balance blocks deduction', () => {
    const result = calculateDeduction(
      { subscription_balance: -0.5, paygo_balance: 0 },
      1,
    );

    expect(result.success).toBe(false);
    expect(result.overageBlocked).toBe(true);
  });

  it('exact balance deduction drains both pools to zero', () => {
    const result = calculateDeduction(
      { subscription_balance: 3, paygo_balance: 2 },
      5,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBe(3);
    expect(result.fromPaygo).toBe(2);
    expect(result.newSubscriptionBalance).toBe(0);
    expect(result.newPaygoBalance).toBe(0);
    expect(result.overageBlocked).toBe(false);
  });

  it('allows slight overage on last action (total < deduction)', () => {
    const result = calculateDeduction(
      { subscription_balance: 1, paygo_balance: 0.5 },
      3,
    );

    // Total available is 1.5, deduction is 3
    // Should still succeed — current action finishes
    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBe(1);
    expect(result.fromPaygo).toBe(0.5);
    // Balances go to zero (not negative — we only deduct what's available)
    expect(result.newSubscriptionBalance).toBe(0);
    expect(result.newPaygoBalance).toBe(0);
  });

  it('handles very small decimal amounts', () => {
    const result = calculateDeduction(
      { subscription_balance: 0.0001, paygo_balance: 0.0002 },
      0.175,
    );

    expect(result.success).toBe(true);
    expect(result.fromSubscription).toBeCloseTo(0.0001, 6);
    expect(result.fromPaygo).toBeCloseTo(0.0002, 6);
  });
});
