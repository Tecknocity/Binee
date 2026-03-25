'use client';

import React from 'react';
import { Coins } from 'lucide-react';

interface CreditBadgeProps {
  creditsConsumed: number | undefined | null;
}

export default function CreditBadge({ creditsConsumed }: CreditBadgeProps) {
  if (creditsConsumed == null || creditsConsumed <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted bg-navy-dark/40 px-2 py-0.5 rounded-full">
      <Coins className="w-3 h-3" />
      {creditsConsumed} credit{creditsConsumed !== 1 ? 's' : ''}
    </span>
  );
}
