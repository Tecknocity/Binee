'use client';

import { useRouter } from 'next/navigation';
import { X, Coins, Zap, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutOfCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function OutOfCreditsModal({ open, onClose }: OutOfCreditsModalProps) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-text-primary">Out of Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-text-secondary">
            Your workspace has used all available AI credits. Upgrade your plan or purchase additional credits to continue using AI features.
          </p>

          <p className="text-xs text-text-muted">
            Your dashboards, health checks, and settings are still fully accessible.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                onClose();
                router.push('/settings/billing');
              }}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'bg-accent hover:bg-accent-hover text-white'
              )}
            >
              <Zap className="w-4 h-4" />
              Upgrade Plan
            </button>

            <button
              onClick={() => {
                onClose();
                router.push('/settings/billing#credits');
              }}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'bg-surface border border-border hover:border-accent/30 text-text-primary hover:text-accent'
              )}
            >
              <ShoppingCart className="w-4 h-4" />
              Buy Credits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
