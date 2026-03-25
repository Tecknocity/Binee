'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Map a database row to a Conversation object
  const mapRow = useCallback(
    (c: { id: string; title: string | null; summary: string | null; updated_at: string; created_at: string }) => ({
      id: c.id,
      title: c.title || 'New conversation',
      lastMessage: c.summary || '',
      messageCount: 0,
      updatedAt: new Date(c.updated_at),
      createdAt: new Date(c.created_at),
    }),
    [],
  );

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
        setConversations((data ?? []).map(mapRow));
      }
    } catch {
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspace, user, supabase, mapRow]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time subscription for conversation changes
  useEffect(() => {
    if (!workspace?.id || !user?.id) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`conversations-${workspace.id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; title: string | null; summary: string | null; updated_at: string; created_at: string };
          // Only add conversations belonging to this user
          if (row.user_id !== user.id) return;
          setConversations((prev) => {
            // Avoid duplicates (optimistic insert may already exist)
            if (prev.some((c) => c.id === row.id)) return prev;
            return [mapRow(row), ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; title: string | null; summary: string | null; updated_at: string; created_at: string };
          if (row.user_id !== user.id) return;
          setConversations((prev) => {
            const updated = prev.map((c) => (c.id === row.id ? mapRow(row) : c));
            // Re-sort by updated_at desc
            return updated.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          const row = payload.old as { id: string };
          setConversations((prev) => prev.filter((c) => c.id !== row.id));
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspace?.id, user?.id, supabase, mapRow]);

  // Create a new conversation in the database
  const createConversation = useCallback(async () => {
    if (!workspace || !user) return `conv-${Date.now()}`;

    // Optimistic local insert
    const tempId = `conv-${Date.now()}`;
    const optimistic: Conversation = {
      id: tempId,
      title: 'New conversation',
      lastMessage: '',
      messageCount: 0,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    setConversations((prev) => [optimistic, ...prev]);
    setActiveConversationId(tempId);

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          title: 'New conversation',
          context_type: 'general',
        })
        .select('id, title, summary, updated_at, created_at')
        .single();

      if (error) {
        console.error('Failed to create conversation:', error.message);
        return tempId;
      }

      // Replace the optimistic entry with the real one
      const realConv = mapRow(data);
      setConversations((prev) =>
        prev.map((c) => (c.id === tempId ? realConv : c)),
      );
      setActiveConversationId(realConv.id);
      return realConv.id;
    } catch {
      return tempId;
    }
  }, [workspace, user, supabase, mapRow]);

  // Delete a conversation from the database
  const deleteConversation = useCallback(
    async (id: string) => {
      // Optimistic remove
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining[0]?.id ?? null);
      }

      // Only delete from DB for real (non-temp) IDs
      if (!id.startsWith('conv-')) {
        try {
          const { error, count } = await supabase
            .from('conversations')
            .delete({ count: 'exact' })
            .eq('id', id);
          if (error) {
            console.error('Failed to delete conversation:', error.message, error.code);
            // Re-fetch to restore state on failure
            fetchConversations();
          } else if (count === 0) {
            // RLS blocked the delete — row still exists in DB
            console.warn('Delete returned 0 rows — possible RLS policy issue for conversation:', id);
            fetchConversations();
          }
        } catch (err) {
          console.error('Delete conversation exception:', err);
          fetchConversations();
        }
      }
    },
    [activeConversationId, conversations, supabase, fetchConversations],
  );

  // Rename (update title of) a conversation
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      // Optimistic update
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
      );

      if (!id.startsWith('conv-')) {
        try {
          const { error } = await supabase
            .from('conversations')
            .update({ title: trimmed, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) {
            console.error('Failed to rename conversation:', error.message);
            fetchConversations();
          }
        } catch {
          fetchConversations();
        }
      }
    },
    [supabase, fetchConversations],
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
    renameConversation,
    setActiveConversation,
    refetch: fetchConversations,
  };
}
