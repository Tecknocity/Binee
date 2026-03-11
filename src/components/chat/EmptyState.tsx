'use client';

import {
  MessageSquare,
  Plug,
  CreditCard,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

type Variant = 'no-conversations' | 'no-clickup' | 'no-credits';

interface EmptyStateProps {
  variant: Variant;
  onSuggestedPrompt?: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  'Show me all overdue tasks',
  'Summarize this week\u2019s progress',
  'What are the top priorities for today?',
  'Create a task for the next sprint',
];

export default function EmptyState({
  variant,
  onSuggestedPrompt,
}: EmptyStateProps) {
  if (variant === 'no-clickup') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Connect ClickUp
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (variant === 'no-credits') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
        >
          Upgrade Plan
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // no-conversations (default / welcome)
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-accent" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Welcome to Binee Chat
      </h2>
      <p className="text-text-secondary max-w-sm mb-8">
        Ask anything about your ClickUp workspace — tasks, progress, team
        activity, and more. Binee can also take actions on your behalf.
      </p>

      <div className="grid gap-2 w-full max-w-md">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
          Try asking
        </p>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSuggestedPrompt?.(prompt)}
            className="flex items-center gap-3 text-left px-4 py-3 rounded-xl bg-surface border border-border hover:border-border-light hover:bg-surface-hover transition-colors group"
          >
            <MessageSquare className="w-4 h-4 text-text-muted shrink-0 group-hover:text-accent transition-colors" />
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
