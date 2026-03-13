'use client';

import {
  MessageSquare,
  Plug,
  CreditCard,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

type Variant = 'no-conversations' | 'no-clickup' | 'no-credits';

interface EmptyStateProps {
  variant: Variant;
  onSuggestedPrompt?: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  { text: 'Show me all overdue tasks', icon: '🔴' },
  { text: 'Summarize this week\u2019s progress', icon: '📊' },
  { text: 'What are the top priorities for today?', icon: '🎯' },
  { text: 'Create a task for the next sprint', icon: '✏️' },
];

export default function EmptyState({
  variant,
  onSuggestedPrompt,
}: EmptyStateProps) {
  if (variant === 'no-clickup') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-16">
        <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
          <Plug className="w-7 h-7 text-warning" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Connect ClickUp to get started
        </h2>
        <p className="text-text-secondary max-w-sm mb-6">
          Binee needs access to your ClickUp workspace to answer questions about
          your tasks, projects, and team activity.
        </p>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Connect ClickUp
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (variant === 'no-credits') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-16">
        <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
          <CreditCard className="w-7 h-7 text-error" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          You&apos;re out of credits
        </h2>
        <p className="text-text-secondary max-w-sm mb-6">
          Upgrade your plan or purchase more credits to continue chatting with
          Binee.
        </p>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Upgrade Plan
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // no-conversations (default / welcome)
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 overflow-hidden">
        <Image src="/Binee__icon__white.svg" alt="Binee" width={36} height={36} unoptimized />
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Welcome to Binee
      </h2>
      <p className="text-text-secondary max-w-md mb-8 text-sm leading-relaxed">
        Your AI workspace assistant. Ask about tasks, track progress, get insights,
        and take actions in your ClickUp workspace.
      </p>

      <div className="grid gap-2 w-full max-w-md">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">
          Try asking
        </p>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.text}
            onClick={() => onSuggestedPrompt?.(prompt.text)}
            className="flex items-center gap-3 text-left px-4 py-3 rounded-xl bg-surface border border-border hover:border-accent/30 hover:bg-surface-hover transition-all duration-150 group"
          >
            <span className="text-base">{prompt.icon}</span>
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {prompt.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
