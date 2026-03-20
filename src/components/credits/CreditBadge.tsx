'use client';

import { useRouter } from 'next/navigation';
import { Coins } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PLAN_CREDITS } from '@/lib/credits';
import CreditIndicator from '@/components/credits/CreditIndicator';

/**
 * Header badge showing the workspace's current credit balance.
 *
 * - Color-coded: green (>50%), yellow (25-50%), red (<25%) of plan allocation
 * - Animated indicator flashes on deduction (via CreditIndicator)
 * - Clicking navigates to /settings/billing
 */
export default function CreditBadge() {
  const router = useRouter();
  const { credit_balance, plan_tier } = useWorkspace();

  const allocation = PLAN_CREDITS[plan_tier ?? 'free'] ?? PLAN_CREDITS.free;
  const pct = allocation > 0 ? (credit_balance / allocation) * 100 : 0;

  // Color tier based on remaining percentage of plan allocation
  const color =
    pct > 50
      ? { text: 'text-emerald-400', icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
      : pct > 25
        ? { text: 'text-yellow-400', icon: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
        : { text: 'text-red-400', icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };

  return (
    <button
      onClick={() => router.push('/settings?tab=billing')}
      className={`relative hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${color.bg} border ${color.border} transition-colors hover:brightness-125 cursor-pointer`}
      aria-label={`${credit_balance} credits remaining — click to view billing`}
    >
      <Coins className={`w-3.5 h-3.5 ${color.icon}`} />
      <span className={`text-xs font-mono font-medium ${color.text}`}>
        {credit_balance.toLocaleString()}
      </span>
      <CreditIndicator balance={credit_balance} />
    </button>
  );
}
