'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

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
// Hook
// ---------------------------------------------------------------------------

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { workspace, user } = useAuth();
  const supabase = createBrowserClient();

  // Fetch conversations from the database
  const fetchConversations = useCallback(async () => {
    if (!workspace || !user) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, summary, updated_at, created_at')
        .eq('workspace_id', workspace.id)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch conversations:', error.message);
        setConversations([]);
      } else {
        setConversations(
          (data ?? []).map((c) => ({
            id: c.id,
            title: c.title || 'New conversation',
            lastMessage: c.summary || '',
            messageCount: 0,
            updatedAt: new Date(c.updated_at),
            createdAt: new Date(c.created_at),
          })),
        );
      }
    } catch {
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspace, user, supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
