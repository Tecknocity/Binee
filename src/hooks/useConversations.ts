'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { SESSION_RECOVERED_EVENT, VISIBILITY_RECOVERED_EVENT } from '@/hooks/useSessionKeepalive';

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

// Stable module-level Supabase client reference — avoids dependency-array
// churn that causes refetches and realtime channel re-subscriptions.
// Lazy-initialized to avoid SSR/prerender crashes (env vars missing).
let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createBrowserClient();
  return _supabase;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Counter to force realtime channel re-subscription when visibility recovers
  const [realtimeGeneration, setRealtimeGeneration] = useState(0);
  const { workspace, user } = useAuth();
  // Use the stable module-level singleton — getSupabase() always returns
  // the same object, so `supabase` is a stable reference across renders.
  const supabase = getSupabase();
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

  // Stable IDs for dependency arrays — avoids re-running effects when the
  // workspace/user *object* reference changes but the ID hasn't.
  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  // Fetch conversations from the database
  const fetchConversations = useCallback(async () => {
    if (!workspaceId || !userId) {
      // Don't clear existing conversations during transient null windows
      // (e.g. workspace context refreshing). Only clear on first load.
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, summary, updated_at, created_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch conversations:', error.message);
        // Keep existing conversations on error — don't wipe the sidebar
        setConversations((prev) => prev.length > 0 ? prev : []);
      } else {
        const fetched = (data ?? []).map(mapRow);
        // STALE-WHILE-REVALIDATE GUARD: If DB returned empty but we already
        // have conversations, keep them. RLS silently returns zero rows when
        // the auth token is briefly stale during a tab switch.
        setConversations((prev) => {
          if (fetched.length === 0 && prev.length > 0) {
            console.warn('[useConversations] DB returned empty but state has data — keeping existing conversations');
            return prev;
          }
          return fetched;
        });
      }
    } catch {
      // Keep existing conversations on error
      setConversations((prev) => prev.length > 0 ? prev : []);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [workspaceId, userId, mapRow]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Re-fetch on session recovery (stale token was refreshed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRecovered = () => { fetchConversations(); };
    window.addEventListener(SESSION_RECOVERED_EVENT, handleRecovered);
    return () => window.removeEventListener(SESSION_RECOVERED_EVENT, handleRecovered);
  }, [fetchConversations]);

  // Re-subscribe realtime channels + refresh data when tab becomes visible
  // after being hidden. Browsers kill WebSocket connections in background tabs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      setRealtimeGeneration((g: number) => g + 1);
      fetchConversations();
    };
    window.addEventListener(VISIBILITY_RECOVERED_EVENT, handleVisibility);
    return () => window.removeEventListener(VISIBILITY_RECOVERED_EVENT, handleVisibility);
  }, [fetchConversations]);

  // Real-time subscription for conversation changes
  useEffect(() => {
    if (!workspaceId || !userId) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`conversations-${workspaceId}-${userId}-${realtimeGeneration}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId},user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; title: string | null; summary: string | null; updated_at: string; created_at: string };
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
          filter: `workspace_id=eq.${workspaceId},user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; title: string | null; summary: string | null; updated_at: string; created_at: string };
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
          filter: `workspace_id=eq.${workspaceId},user_id=eq.${userId}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton; realtimeGeneration forces re-subscribe on visibility recovery
  }, [workspaceId, userId, mapRow, realtimeGeneration]);

  // Create a new conversation in the database
  const createConversation = useCallback(async () => {
    if (!workspaceId || !userId) return `conv-${Date.now()}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [workspaceId, userId, mapRow]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
    [activeConversationId, conversations, fetchConversations],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
    [fetchConversations],
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
