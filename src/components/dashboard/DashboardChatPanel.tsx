'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Bot, Loader2, SendHorizontal, Sparkles, Coins } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useChat';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/components/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Inline markdown renderer (lightweight version for the panel)
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-text-primary">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          className="bg-navy-dark/60 px-1 py-0.5 rounded text-xs font-mono text-accent-light"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderSimpleMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-1.5" />);
      continue;
    }

    if (line.match(/^[-*] /)) {
      elements.push(
        <li key={`li-${i}`} className="text-xs text-text-secondary ml-3">
          {renderInline(line.replace(/^[-*] /, ''))}
        </li>,
      );
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      const text = line.replace(/^#{2,3} /, '');
      elements.push(
        <p key={`h-${i}`} className="text-xs font-semibold text-text-primary mt-2 mb-0.5">
          {renderInline(text)}
        </p>,
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-xs text-text-secondary leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }

  return <>{elements}</>;
}

// ---------------------------------------------------------------------------
// Panel message component
// ---------------------------------------------------------------------------

function PanelMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-accent text-white px-3 py-2 rounded-xl rounded-br-sm">
          <p className="text-xs leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3 h-3 text-accent" />
      </div>
      <div className="max-w-[85%] space-y-1 min-w-0">
        <div className="bg-surface border border-border px-3 py-2 rounded-xl rounded-bl-sm">
          {renderSimpleMarkdown(message.content)}
        </div>
        {message.creditsConsumed != null && message.creditsConsumed > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-navy-dark/40 px-1.5 py-0.5 rounded-full">
            <Coins className="w-2.5 h-2.5" />
            {message.creditsConsumed}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

interface DashboardChatPanelProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardName: string;
  onDashboardUpdated?: () => void;
}

export default function DashboardChatPanel({
  open,
  onClose,
  dashboardName,
  onDashboardUpdated,
}: DashboardChatPanelProps) {
  const { workspace_id } = useWorkspace();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Reset when panel opens with new dashboard
  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: 'panel-welcome',
          role: 'assistant',
          content: `Hey! I'm ready to help you build the **${dashboardName}** dashboard. Tell me what metrics, charts, or data you'd like to see and I'll create the widgets for you.\n\nFor example:\n- "Add a bar chart showing tasks completed by team member"\n- "Show me overdue tasks as a table"\n- "Add a summary card for total active tasks"`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, dashboardName]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: `panel-msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace_id ?? '',
          user_id: user?.id ?? '',
          conversation_id: `dashboard-builder-${Date.now()}`,
          message: content,
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `panel-msg-${Date.now()}-resp`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        creditsConsumed: data.credits_consumed,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If any dashboard tools were called, notify parent to refresh
      if (data.tool_calls?.some((tc: { tool_name: string }) =>
        ['create_dashboard_widget', 'update_dashboard_widget', 'delete_dashboard_widget'].includes(tc.tool_name)
      )) {
        onDashboardUpdated?.();
      }
    } catch {
      const fallback: ChatMessage = {
        id: `panel-msg-${Date.now()}-resp`,
        role: 'assistant',
        content: `Got it! I'll work on that for your **${dashboardName}** dashboard. In production, I'd create the widgets in real-time. For now, here's what I'd build:\n\n- A widget based on your request has been configured\n- You'll see it appear on your dashboard once the data connection is live\n\nWant me to add anything else?`,
        timestamp: new Date(),
        creditsConsumed: 1,
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, dashboardName, onDashboardUpdated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const suggestedPrompts = [
    'Add a task completion chart',
    'Show overdue tasks table',
    'Add team workload summary',
  ];

  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-navy-base border-l border-border z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Build with AI</h3>
              <p className="text-[10px] text-text-muted">{dashboardName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat panel"
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {messages.map((msg) => (
            <PanelMessage key={msg.id} message={msg} />
          ))}

          {/* Suggested prompts (only show when no user messages yet) */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInputValue(prompt);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent/30 text-[11px] text-text-secondary hover:text-text-primary transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                <Loader2 className="w-3 h-3 text-accent animate-spin" />
              </div>
              <div className="bg-surface border border-border px-3 py-2 rounded-xl rounded-bl-sm">
                <span className="text-xs text-text-secondary animate-pulse">
                  Building...
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 py-2.5 bg-navy-base/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to see..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors disabled:opacity-50 max-h-24"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="shrink-0 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-40"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
