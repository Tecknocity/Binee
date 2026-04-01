'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { queryKeys } from '@/lib/query/keys';
import { SESSION_RECOVERED_EVENT } from '@/hooks/useSessionKeepalive';

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
// Helpers
// ---------------------------------------------------------------------------

function mapRow(c: {
  id: string;
  title: string | null;
  summary: string | null;
  updated_at: string;
  created_at: string;
}): Conversation {
  return {
    id: c.id,
    title: c.title || 'New conversation',
    lastMessage: c.summary || '',
    messageCount: 0,
    updatedAt: new Date(c.updated_at),
    createdAt: new Date(c.created_at),
  };
}

// Stable module-level Supabase client — avoids dependency-array churn.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversations() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { workspace, user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  // -------------------------------------------------------------------------
  // React Query: fetch conversations
  // -------------------------------------------------------------------------

  const {
    data: conversations = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: workspaceId && userId ? queryKeys.conversations(workspaceId, userId) : ['conversations', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, summary, updated_at, created_at')
        .eq('workspace_id', workspaceId!)
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch conversations:', error.message);
        throw error;
      }

      return (data ?? []).map(mapRow);
    },
    enabled: !!workspaceId && !!userId,
    // Keep conversations cached for 30 min after navigating away from chat
    gcTime: 30 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  // -------------------------------------------------------------------------
  // Realtime subscription — updates query cache directly
  // -------------------------------------------------------------------------

  // Shared helper: tears down any existing channel and creates a new one.
  // Called by both the main effect (mount/dep-change) and the recovery
  // listener. One function, one channelRef, no cleanup conflicts.
  const subscribeToConversations = useCallback((wsId: string, uid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const key = queryKeys.conversations(wsId, uid);

    const channel = supabase
      .channel(`conversations-${wsId}-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${wsId},user_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string | null;
            summary: string | null;
            updated_at: string;
            created_at: string;
          };
          queryClient.setQueryData<Conversation[]>(key, (prev = []) => {
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
          filter: `workspace_id=eq.${wsId},user_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string | null;
            summary: string | null;
            updated_at: string;
            created_at: string;
          };
          queryClient.setQueryData<Conversation[]>(key, (prev = []) => {
            const updated = prev.map((c) => (c.id === row.id ? mapRow(row) : c));
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
          filter: `workspace_id=eq.${wsId},user_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.old as { id: string };
          queryClient.setQueryData<Conversation[]>(key, (prev = []) =>
            prev.filter((c) => c.id !== row.id),
          );
        },
      )
      .subscribe();

    channelRef.current = channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, queryClient]);

  useEffect(() => {
    if (!workspaceId || !userId) return;

    subscribeToConversations(workspaceId, userId);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [workspaceId, userId, subscribeToConversations]);

  // Reconnect conversations realtime channel after session recovery.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReconnect = () => {
      if (workspaceId && userId) {
        subscribeToConversations(workspaceId, userId);
      }
    };

    window.addEventListener(SESSION_RECOVERED_EVENT, handleReconnect);
    return () => window.removeEventListener(SESSION_RECOVERED_EVENT, handleReconnect);
  }, [workspaceId, userId, subscribeToConversations]);

  // -------------------------------------------------------------------------
  // Mutations (optimistic updates via query cache)
  // -------------------------------------------------------------------------

  const createConversation = useCallback(async () => {
    if (!workspaceId || !userId) return `conv-${Date.now()}`;

    const tempId = `conv-${Date.now()}`;
    const optimistic: Conversation = {
      id: tempId,
      title: 'New conversation',
      lastMessage: '',
      messageCount: 0,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    const key = queryKeys.conversations(workspaceId, userId);
    queryClient.setQueryData<Conversation[]>(key, (prev = []) => [optimistic, ...prev]);
    setActiveConversationId(tempId);

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title: 'New conversation',
          context_type: 'general',
        })
        .select('id, title, summary, updated_at, created_at')
        .single();

      if (error) {
        console.error('Failed to create conversation:', error.message);
        return tempId;
      }

      const realConv = mapRow(data);
      queryClient.setQueryData<Conversation[]>(key, (prev = []) =>
        prev.map((c) => (c.id === tempId ? realConv : c)),
      );
      setActiveConversationId(realConv.id);
      return realConv.id;
    } catch {
      return tempId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId, queryClient]);

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!workspaceId || !userId) return;

      const key = queryKeys.conversations(workspaceId, userId);
      const previous = queryClient.getQueryData<Conversation[]>(key);

      // Optimistic remove
      queryClient.setQueryData<Conversation[]>(key, (prev = []) =>
        prev.filter((c) => c.id !== id),
      );
      if (activeConversationId === id) {
        const remaining = (previous ?? []).filter((c) => c.id !== id);
        setActiveConversationId(remaining[0]?.id ?? null);
      }

      if (!id.startsWith('conv-')) {
        try {
          const { error, count } = await supabase
            .from('conversations')
            .delete({ count: 'exact' })
            .eq('id', id);
          if (error || count === 0) {
            if (error) console.error('Failed to delete conversation:', error.message);
            if (count === 0) console.warn('Delete returned 0 rows — possible RLS issue:', id);
            // Rollback
            queryClient.setQueryData<Conversation[]>(key, previous);
          }
        } catch (err) {
          console.error('Delete conversation exception:', err);
          queryClient.setQueryData<Conversation[]>(key, previous);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, userId, activeConversationId, queryClient],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed || !workspaceId || !userId) return;

      const key = queryKeys.conversations(workspaceId, userId);

      // Optimistic update
      queryClient.setQueryData<Conversation[]>(key, (prev = []) =>
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
            refetch();
          }
        } catch {
          refetch();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, userId, queryClient, refetch],
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
    refetch,
  };
}
