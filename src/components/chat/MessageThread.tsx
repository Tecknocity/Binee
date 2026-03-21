'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessage as ChatMessageType, DashboardChoiceData } from '@/hooks/useChat';
import ChatMessage from './ChatMessage';

interface MessageThreadProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onConfirmAction: (id: string) => void;
  onCancelAction: (id: string) => void;
  onAlwaysAllowAction?: (id: string, toolName: string) => void;
  onDashboardChoice?: (messageId: string, choice: DashboardChoiceData) => void;
}

export default function MessageThread({
  messages,
  isLoading,
  onConfirmAction,
  onCancelAction,
  onAlwaysAllowAction,
  onDashboardChoice,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onConfirmAction={onConfirmAction}
            onCancelAction={onCancelAction}
            onAlwaysAllowAction={onAlwaysAllowAction}
            onDashboardChoice={onDashboardChoice}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            </div>
            <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary animate-pulse">
                  Binee is thinking...
                </span>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
