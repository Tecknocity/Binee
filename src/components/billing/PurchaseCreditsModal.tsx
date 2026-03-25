'use client';

import { useState } from 'react';
import { X, Coins, Loader2 } from 'lucide-react';
import { PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';
import { cn } from '@/lib/utils';

interface PurchaseCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [25, 50, 100] as const;

export default function PurchaseCreditsModal({ open, onClose }: PurchaseCreditsModalProps) {
  const [credits, setCredits] = useState(50);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const totalCents = credits * PAYGO_PRICE_PER_CREDIT_CENTS;
  const totalDollars = (totalCents / 100).toFixed(2);

  async function handlePurchase() {
    if (credits < 1) return;
    setLoading(true);

    try {
      const res = await fetch('/api/billing/create-payg-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits }),
      });

      if (!res.ok) throw new Error('Failed to create checkout');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Handled by API
    } finally {
      setLoading(false);
    }
  }

  function handleCustomChange(value: string) {
    setCustomInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      setCredits(num);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Buy Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Quick amount buttons */}
          <div>
            <p className="text-sm text-text-secondary mb-3">Choose an amount</p>
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => { setCredits(amount); setCustomInput(''); }}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    credits === amount && !customInput
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-surface border-border text-text-secondary hover:border-accent/30'
                  )}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Or enter custom amount</label>
            <input
              type="number"
              min={1}
              placeholder="e.g., 200"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-navy-base border border-border text-text-primary text-sm placeholder:text-text-muted focus:border-accent/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Price calculation */}
          <div className="bg-navy-base rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {credits} credits × ${(PAYGO_PRICE_PER_CREDIT_CENTS / 100).toFixed(2)}
              </span>
              <span className="text-lg font-bold text-text-primary font-mono">
                ${totalDollars}
              </span>
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-text-muted">
            Credits never expire. Subscribe for better per-credit rates.
          </p>

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={loading || credits < 1}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
              loading || credits < 1
                ? 'bg-accent/50 text-white/70 cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-white'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Purchase {credits} Credits — ${totalDollars}
          </button>
        </div>
      </div>
    </div>
  );
}
