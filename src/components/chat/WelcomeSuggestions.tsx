'use client';

import {
  MessageSquare,
  Zap,
  Settings,
  LayoutDashboard,
  HeartPulse,
} from 'lucide-react';

interface WelcomeSuggestionsProps {
  onSuggestedPrompt: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    text: 'Show me my overdue tasks',
    icon: MessageSquare,
    label: 'Ask about tasks',
  },
  {
    text: 'What actions can you take in my workspace?',
    icon: Zap,
    label: 'Take actions',
  },
  {
    text: 'Help me organize my workspace',
    icon: Settings,
    label: 'Set up workspace',
  },
  {
    text: 'Create a dashboard for my team',
    icon: LayoutDashboard,
    label: 'Build dashboards',
  },
  {
    text: 'Run a health check on my workspace',
    icon: HeartPulse,
    label: 'Check health',
  },
];

export default function WelcomeSuggestions({ onSuggestedPrompt }: WelcomeSuggestionsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 pb-4">
      <div className="grid gap-1.5">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              onClick={() => onSuggestedPrompt(suggestion.text)}
              className="flex items-center gap-3 text-left px-3 py-2.5 rounded-xl bg-surface border border-border hover:border-accent/30 hover:bg-surface-hover transition-all duration-150 group"
            >
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                  {suggestion.label}
                </span>
                <p className="text-[11px] text-text-muted truncate">
                  {suggestion.text}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
