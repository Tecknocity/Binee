import { WARNING_THRESHOLDS } from '../config';
import type { UserCreditAccount } from '../types/credits';
import type { CreditWarning } from '../types/warnings';

const WARNINGS: CreditWarning[] = [
  {
    threshold_absolute: WARNING_THRESHOLDS.empty,
    warning_type: 'empty',
    message: "You've used all your credits. Purchase more to continue.",
  },
  {
    threshold_absolute: WARNING_THRESHOLDS.critical,
    warning_type: 'critical',
    message: "You're almost out of credits. Purchase more to keep using Binee.",
  },
  {
    threshold_absolute: WARNING_THRESHOLDS.low,
    warning_type: 'low',
    message: 'You have {credits} credits remaining. Consider topping up.',
  },
];

/**
 * Check credit warnings after every deduction.
 *
 * Returns the most severe applicable warning, or null if balance is healthy.
 */
export function checkCreditWarnings(
  account: Pick<UserCreditAccount, 'subscription_balance' | 'paygo_balance'>,
): CreditWarning | null {
  const total = Math.floor(account.subscription_balance + account.paygo_balance);

  if (total <= WARNING_THRESHOLDS.empty) return WARNINGS[0];
  if (total <= WARNING_THRESHOLDS.critical) return WARNINGS[1];
  if (total <= WARNING_THRESHOLDS.low) {
    return {
      ...WARNINGS[2],
      message: WARNINGS[2].message.replace('{credits}', String(total)),
    };
  }

  return null;
}
