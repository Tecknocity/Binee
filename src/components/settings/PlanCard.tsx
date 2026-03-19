'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  popular?: boolean;
}

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  onUpgrade?: (planId: string) => void;
}

export default function PlanCard({ plan, isCurrent, onUpgrade }: PlanCardProps) {
  return (
    <div
      className={cn(
        'relative border rounded-xl p-5 transition-colors',
        plan.popular ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border',
        isCurrent && 'ring-1 ring-accent'
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-accent text-white px-2.5 py-0.5 rounded-full">
          Popular
        </span>
      )}

      <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
      <div className="flex items-baseline gap-1 mt-2 mb-4">
        <span className="text-3xl font-bold text-text-primary">${plan.price}</span>
        <span className="text-text-muted text-sm">/mo</span>
      </div>

      <ul className="space-y-2 mb-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
            <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        disabled={isCurrent}
        onClick={() => onUpgrade?.(plan.id)}
        className={cn(
          'w-full py-2 rounded-lg text-sm font-medium transition-colors',
          isCurrent
            ? 'bg-surface border border-border text-text-muted cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-white'
        )}
      >
        {isCurrent ? 'Current plan' : 'Upgrade'}
      </button>
    </div>
  );
}
