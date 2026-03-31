'use client';

import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirmAction?: (id: string) => void;
  onCancelAction?: (id: string) => void;
  onAlwaysAllowAction?: (id: string, toolName: string) => void;
}

export default function ChatMessage({
  message,
  onConfirmAction,
  onCancelAction,
  onAlwaysAllowAction,
}: ChatMessageProps) {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }

  return (
    <AssistantMessage
      message={message}
      onConfirmAction={onConfirmAction}
      onCancelAction={onCancelAction}
      onAlwaysAllowAction={onAlwaysAllowAction}
    />
  );
}
