'use client';

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import type { ChatMessage } from '@/hooks/useChat';

// ---------------------------------------------------------------------------
// Chat message cache — survives navigation between tabs.
//
// When ChatPage unmounts (user navigates to Dashboards, Health, etc.),
// all local useState in useChat is destroyed. Without a cache, returning
// to the conversation triggers a full database fetch (slow, shows spinner).
//
// This context stores a Map<conversationId, ChatMessage[]> that persists
// across page navigations. When ChatPage mounts, useChat checks the cache
// first — if messages exist, they're displayed instantly with no spinner.
// ---------------------------------------------------------------------------

interface ChatCacheContextValue {
  /** Get cached messages for a conversation (returns empty array if not cached). */
  get: (conversationId: string) => ChatMessage[];
  /** Store messages for a conversation in the cache. */
  set: (conversationId: string, messages: ChatMessage[]) => void;
  /** Clear cache for a specific conversation. */
  clear: (conversationId: string) => void;
}

const ChatCacheContext = createContext<ChatCacheContextValue | null>(null);

const MAX_CACHED_CONVERSATIONS = 20;

export function ChatCacheProvider({ children }: { children: ReactNode }) {
  // Use a ref for the Map so updates don't trigger re-renders of the provider.
  // The cache is "write-through" — consumers call set() after every state
  // update, and get() on mount. No reactivity needed.
  const cacheRef = useRef<Map<string, ChatMessage[]>>(new Map());

  const get = useCallback((conversationId: string): ChatMessage[] => {
    return cacheRef.current.get(conversationId) ?? [];
  }, []);

  const set = useCallback((conversationId: string, messages: ChatMessage[]) => {
    const cache = cacheRef.current;
    cache.set(conversationId, messages);

    // Evict oldest entries if cache exceeds limit
    if (cache.size > MAX_CACHED_CONVERSATIONS) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }, []);

  const clear = useCallback((conversationId: string) => {
    cacheRef.current.delete(conversationId);
  }, []);

  return (
    <ChatCacheContext.Provider value={{ get, set, clear }}>
      {children}
    </ChatCacheContext.Provider>
  );
}

export function useChatCache(): ChatCacheContextValue {
  const ctx = useContext(ChatCacheContext);
  if (!ctx) {
    throw new Error('useChatCache must be used within a <ChatCacheProvider>');
  }
  return ctx;
}
