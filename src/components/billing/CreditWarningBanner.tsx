'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { useCreditBalance } from '@/billing/hooks/useCreditBalance';
import { useCreditWarnings } from '@/billing/hooks/useCreditWarnings';
import { cn } from '@/lib/utils';

/**
 * CreditWarningBanner — shows at top of chat and as global banner.
 *
 * - Low (≤10): Yellow — "You have {X} credits remaining. [Top Up] [Change Plan]"
 * - Critical (≤3): Red — "You're almost out of credits! [Buy Credits Now]"
 * - Empty (0): Red, persistent — "You've used all your credits. [Purchase More]"
 */
export default function CreditWarningBanner() {
  const router = useRouter();
  const { balance, loading } = useCreditBalance();
  const { warning } = useCreditWarnings({ balance, loading });

  if (!warning) return null;

  const isLow = warning.warning_type === 'low';
  const isCritical = warning.warning_type === 'critical';
  const isEmpty = warning.warning_type === 'empty';

  const Icon = isEmpty || isCritical ? AlertCircle : AlertTriangle;

  return (
    <div
      className={cn(
        'w-full px-4 py-2.5 flex items-center gap-3',
        isLow && 'bg-yellow-500/10 border-b border-yellow-500/20',
        isCritical && 'bg-red-500/10 border-b border-red-500/20',
        isEmpty && 'bg-red-500/10 border-b border-red-500/20'
      )}
    >
      <Icon
        className={cn(
          'w-4 h-4 shrink-0',
          isLow ? 'text-yellow-400' : 'text-red-400'
        )}
      />

      <p
        className={cn(
          'flex-1 text-sm',
          isLow ? 'text-yellow-200' : 'text-red-200'
        )}
      >
        {isEmpty && "You've used all your credits."}
        {isCritical && "You're almost out of credits!"}
        {isLow && `You have ${balance} credits remaining.`}
      </p>

      <div className="flex items-center gap-2 shrink-0">
        {isLow && (
          <>
            <button
              onClick={() => router.push('/settings?tab=billing#topup')}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors"
            >
              Top Up
            </button>
            <button
              onClick={() => router.push('/settings?tab=billing#plans')}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors"
            >
              Change Plan
            </button>
          </>
        )}

        {isCritical && (
          <button
            onClick={() => router.push('/settings?tab=billing#topup')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Buy Credits Now
          </button>
        )}

        {isEmpty && (
          <button
            onClick={() => router.push('/settings?tab=billing#topup')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Purchase More
          </button>
        )}
      </div>
    </div>
  );
}
