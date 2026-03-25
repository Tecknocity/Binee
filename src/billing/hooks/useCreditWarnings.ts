'use client';

import { useMemo } from 'react';
import { WARNING_THRESHOLDS } from '@/billing/config';
import type { CreditWarning, WarningType } from '@/billing/types/warnings';

interface UseCreditWarningsInput {
  balance: number;
  loading: boolean;
}

/**
 * Evaluates credit warning thresholds client-side.
 * Depends on the balance from useCreditBalance.
 */
export function useCreditWarnings({ balance, loading }: UseCreditWarningsInput): {
  warning: CreditWarning | null;
} {
  const warning = useMemo<CreditWarning | null>(() => {
    if (loading) return null;

    if (balance <= WARNING_THRESHOLDS.empty) {
      return {
        threshold_absolute: WARNING_THRESHOLDS.empty,
        warning_type: 'empty' as WarningType,
        message: "You've used all your credits. Purchase more to continue.",
      };
    }

    if (balance <= WARNING_THRESHOLDS.critical) {
      return {
        threshold_absolute: WARNING_THRESHOLDS.critical,
        warning_type: 'critical' as WarningType,
        message: "You're almost out of credits!",
      };
    }

    if (balance <= WARNING_THRESHOLDS.low) {
      return {
        threshold_absolute: WARNING_THRESHOLDS.low,
        warning_type: 'low' as WarningType,
        message: `You have ${balance} credits remaining.`,
      };
    }

    return null;
  }, [balance, loading]);

  return { warning };
}
