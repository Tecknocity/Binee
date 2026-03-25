import type { UserCreditAccount } from '../types/credits';

/** Combined display balance — always a whole number (floor). */
export function getDisplayBalance(
  account: Pick<UserCreditAccount, 'subscription_balance' | 'paygo_balance'>,
): number {
  return Math.floor(account.subscription_balance + account.paygo_balance);
}

/** Breakdown for billing page — both floored and exact values. */
export function getBalanceBreakdown(
  account: Pick<UserCreditAccount, 'subscription_balance' | 'paygo_balance'>,
) {
  return {
    total: getDisplayBalance(account),
    subscriptionCredits: Math.floor(account.subscription_balance),
    paygoCredits: Math.floor(account.paygo_balance),
    exactSubscription: account.subscription_balance,
    exactPaygo: account.paygo_balance,
  };
}
