'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Activity, LayoutDashboard, PartyPopper } from 'lucide-react';
import type { ExecutionResult } from '@/lib/setup/session';

interface SetupCompleteProps {
  executionResult: ExecutionResult | null;
  manualStepsCount: number;
}

const NEXT_ACTIONS = [
  {
    title: 'Open Chat',
    description: 'Ask Binee anything about your workspace',
    icon: MessageSquare,
    href: '/chat',
    color: 'text-info',
    bg: 'bg-info/15',
  },
  {
    title: 'View Health',
    description: 'Monitor your workspace health score',
    icon: Activity,
    href: '/health',
    color: 'text-success',
    bg: 'bg-success/15',
  },
  {
    title: 'See Dashboard',
    description: 'Overview of all your workspaces',
    icon: LayoutDashboard,
    href: '/',
    color: 'text-accent',
    bg: 'bg-accent/15',
  },
] as const;

export function SetupComplete({ executionResult, manualStepsCount }: SetupCompleteProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti animation
    const timer = setTimeout(() => setShowConfetti(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 pb-6">
      {/* Confetti dots */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-5%',
                backgroundColor: ['#854DF9', '#3B82F6', '#10B981', '#F59E0B', '#9D6FFA'][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Success icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
          <PartyPopper className="w-4 h-4 text-accent" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-text-primary mb-2">Your workspace is ready!</h1>
      <p className="text-text-secondary text-center mb-8 max-w-md">
        {executionResult && (
          <>
            Created{' '}
            <span className="text-text-primary font-medium">{executionResult.itemsCreated} items</span> and
            completed{' '}
            <span className="text-text-primary font-medium">{manualStepsCount} manual steps</span>.
            Your ClickUp workspace is fully set up and ready to go.
          </>
        )}
        {!executionResult && 'Your ClickUp workspace is fully set up and ready to go.'}
      </p>

      {/* Next action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {NEXT_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.title}
              href={action.href}
              className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-colors group"
            >
              <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <h2 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                {action.title}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">{action.description}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}
