'use client';

import { User } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useChat';

interface UserMessageProps {
  message: ChatMessage;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end gap-3 mb-4">
      <div className="max-w-[75%] space-y-1">
        <div className="bg-accent text-white px-4 py-2.5 rounded-2xl rounded-br-md">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
        <p className="text-xs text-text-muted text-right px-1">
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-4 h-4 text-accent-light" />
      </div>
    </div>
  );
}
