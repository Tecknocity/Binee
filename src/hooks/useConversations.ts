'use client';

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: Date;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-5',
    title: 'Building October Overdue Dashboard',
    lastMessage: 'I\'ve created your "October Overdue Tasks" dashboard',
    messageCount: 4,
    updatedAt: new Date('2026-03-11T11:00:15'),
    createdAt: new Date('2026-03-11T11:00:00'),
  },
  {
    id: 'conv-1',
    title: 'Overdue tasks in Engineering',
    lastMessage: 'Done! I\'ve updated "API rate limiter update"',
    messageCount: 6,
    updatedAt: new Date('2026-03-11T09:01:10'),
    createdAt: new Date('2026-03-11T09:00:00'),
  },
  {
    id: 'conv-2',
    title: 'Sprint velocity analysis',
    lastMessage: "I'll create that task for you.",
    messageCount: 5,
    updatedAt: new Date('2026-03-10T14:02:02'),
    createdAt: new Date('2026-03-10T14:00:00'),
  },
  {
    id: 'conv-3',
    title: 'Design team weekly summary',
    lastMessage: 'The Design team had a productive week!',
    messageCount: 3,
    updatedAt: new Date('2026-03-09T16:30:08'),
    createdAt: new Date('2026-03-09T16:30:00'),
  },
  {
    id: 'conv-4',
    title: 'Q2 planning project setup',
    lastMessage: "It looks like we hit a rate limit...",
    messageCount: 3,
    updatedAt: new Date('2026-03-08T10:00:05'),
    createdAt: new Date('2026-03-08T10:00:00'),
  },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading] = useState(false);

  const createConversation = useCallback(() => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New conversation',
      lastMessage: '',
      messageCount: 0,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv.id;
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId((prev) => {
          const remaining = conversations.filter((c) => c.id !== id);
          return remaining[0]?.id ?? null;
        });
      }
    },
    [activeConversationId, conversations],
  );

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  return {
    conversations,
    activeConversationId,
    isLoading,
    createConversation,
    deleteConversation,
    setActiveConversation,
  };
}
