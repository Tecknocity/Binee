'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { queryKeys } from '@/lib/query/keys';
import type { Workspace, WorkspaceMember } from '@/types/database';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspace_id: string | null;
  plan_tier: Workspace['plan'] | null;
  credit_balance: number;
  members: WorkspaceMember[];
  membership: WorkspaceMember | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, workspace, membership, loading: authLoading, refreshWorkspace } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [creditOverride, setCreditOverride] = useState<number | null>(null);

  const supabaseRef = useRef(createBrowserClient());
  const supabase = supabaseRef.current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const workspaceId = workspace?.id ?? null;

  // -------------------------------------------------------------------------
  // React Query: fetch workspace members
  // -------------------------------------------------------------------------

  const {
    data: members = [],
  } = useQuery({
    queryKey: workspaceId ? queryKeys.workspaceMembers(workspaceId) : ['workspaceMembers', 'none'],
    queryFn: async () => {
      // Try direct Supabase query first (fast path)
      let directData: WorkspaceMember[] | null = null;
      let directError: { message: string } | null = null;

      const firstAttempt = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .eq('status', 'active');

      if (firstAttempt.error) {
        // Status column may not exist — retry without filter
        const fallback = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId!);
        directData = fallback.data as WorkspaceMember[] | null;
        directError = fallback.error;
      } else {
        directData = firstAttempt.data as WorkspaceMember[] | null;
        directError = firstAttempt.error;
      }

      if (!directError && directData && directData.length > 0) {
        return directData;
      }

      if (directError) {
        console.warn('fetchMembers: direct query failed, falling back to API', directError.message);
      }

      // Fallback: use server API (bypasses RLS)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/workspace/load', { method: 'POST', headers });
        if (res.ok) {
          const apiData = await res.json();
          return (apiData.members ?? [])
            .filter((m: { workspace_id: string }) => m.workspace_id === workspaceId)
            .map((m: Record<string, unknown>) => ({
              id: '',
              workspace_id: m.workspace_id,
              user_id: '',
              role: m.role,
              email: m.email,
              display_name: m.display_name,
              avatar_url: m.avatar_url,
              invited_email: null,
              status: m.status ?? 'active',
              joined_at: null,
              created_at: '',
              updated_at: '',
            })) as WorkspaceMember[];
        }
      } catch (apiErr) {
        console.error('fetchMembers: API fallback also failed', apiErr);
      }

      return directData ?? [];
    },
    enabled: !!workspaceId,
    gcTime: 10 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  // Set error when user has no workspace
  useEffect(() => {
    if (!authLoading && user && !workspace) {
      setError('No workspace found. Please contact support.');
    } else {
      setError(null);
    }
  }, [workspace, authLoading, user]);

  // -------------------------------------------------------------------------
  // Realtime: workspace row updates (credit balance, plan changes)
  // -------------------------------------------------------------------------

  // Use refs for values accessed inside the realtime callback so the
  // callback always reads current state without needing to be recreated
  // (which would tear down and re-subscribe the channel on every render).
  const workspaceStateRef = useRef(workspace);
  workspaceStateRef.current = workspace;
  const refreshWorkspaceRef = useRef(refreshWorkspace);
  refreshWorkspaceRef.current = refreshWorkspace;

  // Shared helper: tears down any existing channel and creates a new one.
  // Called by both the main effect (mount/dep-change) and the recovery
  // listener. One function, one channelRef, no cleanup conflicts.
  const subscribeToWorkspace = useCallback((wsId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`workspace-${wsId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${wsId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const current = workspaceStateRef.current;
          if (!current) return;

          const creditOnly =
            updated.credit_balance !== current.credit_balance &&
            updated.name === current.name &&
            updated.plan === current.plan &&
            updated.slug === current.slug &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updated.clickup_connected === (current as any).clickup_connected;

          if (creditOnly) {
            setCreditOverride(typeof updated.credit_balance === 'number' ? updated.credit_balance : null);
          } else {
            refreshWorkspaceRef.current();
          }
        },
      )
      .subscribe();

    channelRef.current = channel;
  }, [supabase]);

  useEffect(() => {
    if (!workspaceId) return;

    subscribeToWorkspace(workspaceId);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [workspaceId, supabase, subscribeToWorkspace]);

  // Supabase Realtime auto-reconnects WebSocket channels after tab
  // suspension. Manual reconnection was removed — it caused channel
  // teardown/rebuild storms that raced with React Query refetches.

  // -------------------------------------------------------------------------
  // Refetch helper
  // -------------------------------------------------------------------------

  const refetch = useCallback(async () => {
    await Promise.all([
      refreshWorkspace(),
      workspaceId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers(workspaceId) })
        : Promise.resolve(),
    ]);
  }, [refreshWorkspace, workspaceId, queryClient]);

  // Reset credit override when workspace object changes (full refresh)
  useEffect(() => {
    setCreditOverride(null);
  }, [workspace]);

  const loading = authLoading;

  // Memoize context value so consumers only re-render when actual values
  // change. Without this, every AuthProvider state change cascades through
  // WorkspaceProvider to ALL consumers (ChatPage, settings, sidebar, etc.)
  // even when workspace data hasn't changed.
  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace,
    workspace_id: workspaceId,
    plan_tier: workspace?.plan ?? null,
    credit_balance: creditOverride ?? workspace?.credit_balance ?? 0,
    members,
    membership,
    loading,
    error,
    refetch,
  }), [workspace, workspaceId, creditOverride, members, membership, loading, error, refetch]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
}
