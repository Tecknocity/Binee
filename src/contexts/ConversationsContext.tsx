'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useConversations as useConversationsHook } from '@/hooks/useConversations';
import type { Conversation } from '@/hooks/useConversations';

// ---------------------------------------------------------------------------
// Context type — mirrors the return value of useConversations hook
// ---------------------------------------------------------------------------

interface ConversationsContextValue {
  conversations: Conversation[];
  isLoading: boolean;
  createConversation: () => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  refetch: () => Promise<unknown>;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — wraps the hook so a single instance is shared app-wide
// ---------------------------------------------------------------------------

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const {
    conversations,
    isLoading,
    createConversation,
    deleteConversation,
    renameConversation,
    refetch,
  } = useConversationsHook();

  // Memoize so consumers only re-render when actual values change,
  // not on every parent render (which would cascade through the entire app).
  const value = useMemo<ConversationsContextValue>(() => ({
    conversations,
    isLoading,
    createConversation,
    deleteConversation,
    renameConversation,
    refetch,
  }), [conversations, isLoading, createConversation, deleteConversation, renameConversation, refetch]);

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook — replaces direct useConversations() calls in components
// ---------------------------------------------------------------------------

export function useSharedConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error(
      'useSharedConversations must be used within a <ConversationsProvider>',
    );
  }
  return ctx;
}
