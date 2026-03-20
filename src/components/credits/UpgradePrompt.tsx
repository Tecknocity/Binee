'use client';

import { useRouter } from 'next/navigation';
import { Coins, Zap } from 'lucide-react';

export default function UpgradePrompt() {
  const router = useRouter();

  return (
    <div className="border-t border-border bg-navy-base/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center gap-3 max-w-3xl mx-auto bg-warning/5 border border-warning/20 rounded-xl px-4 py-3">
        <Coins className="w-5 h-5 text-warning shrink-0" />
        <p className="flex-1 text-sm text-text-secondary">
          You&apos;re out of AI credits.{' '}
          <button
            onClick={() => router.push('/settings/billing')}
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Upgrade your plan
          </button>
          {' '}or{' '}
          <button
            onClick={() => router.push('/settings/billing#credits')}
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            buy more credits
          </button>
          {' '}to continue chatting.
        </p>
        <button
          onClick={() => router.push('/settings/billing')}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Upgrade
        </button>
      </div>
    </div>
  );
}
