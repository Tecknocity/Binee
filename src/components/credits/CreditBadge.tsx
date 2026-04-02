'use client';

import { useRouter } from 'next/navigation';
import { Coins, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WARNING_THRESHOLDS } from '@/billing/config';
import CreditIndicator from '@/components/credits/CreditIndicator';
import { cn } from '@/lib/utils';

/**
 * Header badge showing the workspace's current credit balance.
 *
 * Color-coded by absolute warning thresholds (not percentage):
 *   - Normal (>10): green
 *   - Low (≤10): yellow
 *   - Critical (≤3): red
 *   - Empty (0): red with "!" icon
 */
export default function CreditBadge() {
  const router = useRouter();
  const { credit_balance } = useWorkspace();

  const displayBalance = Math.round(credit_balance);

  const color = (() => {
    if (displayBalance <= WARNING_THRESHOLDS.empty) {
      return { text: 'text-red-400', icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }
    if (displayBalance <= WARNING_THRESHOLDS.critical) {
      return { text: 'text-red-400', icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }
    if (displayBalance <= WARNING_THRESHOLDS.low) {
      return { text: 'text-yellow-400', icon: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
    }
    return { text: 'text-emerald-400', icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  })();

  return (
    <button
      onClick={() => router.push('/settings?tab=billing')}
      className={cn(
        'relative hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors hover:brightness-125 cursor-pointer',
        color.bg,
        color.border
      )}
      aria-label={`${displayBalance} credits remaining — click to view billing`}
    >
      <Coins className={cn('w-3.5 h-3.5', color.icon)} />
      <span className={cn('text-xs font-mono font-medium', color.text)}>
        {displayBalance.toLocaleString()}
      </span>
      {displayBalance <= WARNING_THRESHOLDS.empty && (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      )}
      <CreditIndicator balance={displayBalance} />
    </button>
  );
}
