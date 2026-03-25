'use client';

import { useRouter } from 'next/navigation';
import { Coins, ShoppingCart, Zap } from 'lucide-react';

/**
 * ZeroCreditPrompt — Overlay shown in chat when user has 0 credits.
 *
 * Blocks the chat input from sending new messages.
 * Dashboards and health data remain accessible.
 */
interface ZeroCreditPromptProps {
  onBuyCredits?: () => void;
}

export default function ZeroCreditPrompt({ onBuyCredits }: ZeroCreditPromptProps) {
  const router = useRouter();

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-navy-base/80 backdrop-blur-sm rounded-xl">
      <div className="max-w-sm mx-4 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mx-auto">
          <Coins className="w-7 h-7 text-red-400" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            You&apos;ve run out of credits
          </h3>
          <p className="text-sm text-text-secondary mt-1.5">
            Your dashboards and health data are still accessible.
            Purchase credits or subscribe to a plan to continue chatting.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={() => {
              if (onBuyCredits) {
                onBuyCredits();
              } else {
                router.push('/settings?tab=billing#topup');
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface border border-border hover:border-accent/30 text-text-primary hover:text-accent transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Buy Credits
          </button>

          <button
            onClick={() => router.push('/settings?tab=billing#plans')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Zap className="w-4 h-4" />
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
