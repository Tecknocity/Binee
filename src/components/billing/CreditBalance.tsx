'use client';

import { useRouter } from 'next/navigation';
import { Coins, AlertCircle } from 'lucide-react';
import { useCreditBalance } from '@/billing/hooks/useCreditBalance';
import { useCreditWarnings } from '@/billing/hooks/useCreditWarnings';
import { cn } from '@/lib/utils';

/**
 * CreditBalance — Global header credit display.
 *
 * Shows a single combined number (Math.floor(subscription + paygo)).
 * Color-coded by warning thresholds:
 *   - Normal (>10): green
 *   - Low (≤10): yellow
 *   - Critical (≤3): red
 *   - Empty (0): red with "!" icon
 */
export default function CreditBalance() {
  const router = useRouter();
  const { balance, loading } = useCreditBalance();
  const { warning } = useCreditWarnings({ balance, loading });

  const color = (() => {
    if (!warning) {
      return {
        text: 'text-emerald-400',
        icon: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
      };
    }
    if (warning.warning_type === 'low') {
      return {
        text: 'text-yellow-400',
        icon: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
      };
    }
    // critical or empty
    return {
      text: 'text-red-400',
      icon: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    };
  })();

  if (loading) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover/50 border border-border animate-pulse">
        <Coins className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-mono font-medium text-text-muted">—</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => router.push('/settings?tab=billing')}
      className={cn(
        'relative hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors hover:brightness-125 cursor-pointer',
        color.bg,
        color.border
      )}
      aria-label={`${balance} credits remaining — click to view billing`}
    >
      <Coins className={cn('w-3.5 h-3.5', color.icon)} />
      <span className={cn('text-xs font-mono font-medium', color.text)}>
        {balance.toLocaleString()} credits
      </span>
      {warning?.warning_type === 'empty' && (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      )}
    </button>
  );
}
