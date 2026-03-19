'use client';

import { useEffect, useRef, useState } from 'react';

interface CreditIndicatorProps {
  /** Current credit balance — triggers animation on change */
  balance: number;
}

/**
 * Animated indicator that briefly flashes when credits are deducted.
 * Renders a small pulsing dot next to the credit badge.
 */
export default function CreditIndicator({ balance }: CreditIndicatorProps) {
  const [animating, setAnimating] = useState(false);
  const prevBalance = useRef(balance);

  useEffect(() => {
    // Only animate when balance decreases (deduction)
    if (prevBalance.current > balance) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 1200);
      return () => clearTimeout(timer);
    }
    prevBalance.current = balance;
  }, [balance]);

  // Update ref after effect runs
  useEffect(() => {
    prevBalance.current = balance;
  }, [balance]);

  if (!animating) return null;

  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
    </span>
  );
}
