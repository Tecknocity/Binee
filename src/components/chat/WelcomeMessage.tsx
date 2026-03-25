'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Zap,
  Settings,
  LayoutDashboard,
  HeartPulse,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import { createBrowserClient } from '@/lib/supabase/client';

interface WorkspaceStats {
  spaces: number;
  lists: number;
  tasks: number;
}

interface WelcomeMessageProps {
  firstName?: string;
  workspaceId: string;
  onSuggestedPrompt?: (prompt: string) => void;
}

const WELCOME_SUGGESTIONS = [
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

export default function WelcomeMessage({
  firstName,
  workspaceId,
  onSuggestedPrompt,
}: WelcomeMessageProps) {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const supabase = createBrowserClient();

        // Fetch sync counts from clickup_connections
        const { data: connection } = await supabase
          .from('clickup_connections')
          .select('synced_spaces, synced_lists, synced_tasks')
          .eq('workspace_id', workspaceId)
          .single();

        if (!cancelled && connection) {
          setStats({
            spaces: connection.synced_spaces ?? 0,
            lists: connection.synced_lists ?? 0,
            tasks: connection.synced_tasks ?? 0,
          });
        }
      } catch {
        // Stats are best-effort; component still renders without them
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const greeting = firstName ? `Hi ${firstName}!` : 'Hi there!';

  const statsLine = stats
    ? `I synced your workspace — ${stats.spaces} space${stats.spaces !== 1 ? 's' : ''}, ${stats.lists} list${stats.lists !== 1 ? 's' : ''}, ${stats.tasks.toLocaleString()} task${stats.tasks !== 1 ? 's' : ''}.`
    : null;

  return (
    <div className="flex gap-3 max-w-2xl">
      {/* Binee avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden">
        <Image
          src="/Binee__icon__white.svg"
          alt="Binee"
          width={20}
          height={20}
          unoptimized
        />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Message bubble */}
        <div className="bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-3">
          <p className="text-sm text-text-primary leading-relaxed">
            {greeting}{' '}
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing your workspace…
              </span>
            ) : statsLine ? (
              statsLine
            ) : (
              <span>I&apos;ve connected to your workspace and I&apos;m ready to help.</span>
            )}
          </p>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Here are some things I can help you with:
          </p>
        </div>

        {/* Suggestion cards */}
        <div className="grid gap-1.5">
          {WELCOME_SUGGESTIONS.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={suggestion.text}
                onClick={() => onSuggestedPrompt?.(suggestion.text)}
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
    </div>
  );
}
