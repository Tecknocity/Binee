'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useConversations as useConversationsHook } from '@/hooks/useConversations';
import type { Conversation } from '@/hooks/useConversations';

// ---------------------------------------------------------------------------
// Context type — mirrors the return value of useConversations hook
// ---------------------------------------------------------------------------

interface ConversationsContextValue {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  createConversation: () => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  refetch: () => Promise<unknown>;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider — wraps the hook so a single instance is shared app-wide
// ---------------------------------------------------------------------------

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const value = useConversationsHook();
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
