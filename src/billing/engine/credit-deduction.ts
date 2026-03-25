import type { UserCreditAccount } from '../types/credits';

export interface DeductionResult {
  success: boolean;
  /** Credits deducted from subscription pool */
  fromSubscription: number;
  /** Credits deducted from PAYG pool */
  fromPaygo: number;
  /** Balance remaining in subscription pool after deduction */
  newSubscriptionBalance: number;
  /** Balance remaining in PAYG pool after deduction */
  newPaygoBalance: number;
  /** True if user had zero credits before this action */
  overageBlocked: boolean;
}

/**
 * Core two-pool spending algorithm.
 *
 * Always deducts from subscription pool first (expiring credits),
 * then from PAYG pool (never expires).
 *
 * This TypeScript version is for unit testing. The actual runtime
 * uses the atomic SQL function `deduct_credits` which applies
 * FOR UPDATE row locking to prevent race conditions.
 */
export function calculateDeduction(
  account: Pick<UserCreditAccount, 'subscription_balance' | 'paygo_balance'>,
  creditsToDeduct: number,
): DeductionResult {
  const totalAvailable = account.subscription_balance + account.paygo_balance;

  // If user has zero credits, block — current action should not proceed
  if (totalAvailable <= 0) {
    return {
      success: false,
      fromSubscription: 0,
      fromPaygo: 0,
      newSubscriptionBalance: account.subscription_balance,
      newPaygoBalance: account.paygo_balance,
      overageBlocked: true,
    };
  }

  // Deduct from subscription first (expiring credits should be used first)
  let remainingDeduction = creditsToDeduct;
  let fromSubscription = 0;
  let fromPaygo = 0;

  if (account.subscription_balance > 0) {
    fromSubscription = Math.min(account.subscription_balance, remainingDeduction);
    remainingDeduction -= fromSubscription;
  }

  // Then from PAYG (safety net, never expires)
  if (remainingDeduction > 0 && account.paygo_balance > 0) {
    fromPaygo = Math.min(account.paygo_balance, remainingDeduction);
    // remainingDeduction -= fromPaygo;
    // If there's still remaining after both pools, the user went into slight overage.
    // This can happen on the last action — we allow it (current action finishes).
  }

  return {
    success: true,
    fromSubscription,
    fromPaygo,
    newSubscriptionBalance: account.subscription_balance - fromSubscription,
    newPaygoBalance: account.paygo_balance - fromPaygo,
    overageBlocked: false,
  };
}
