'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { SESSION_RECOVERED_EVENT, VISIBILITY_RECOVERED_EVENT } from '@/hooks/useSessionKeepalive';
import type { Workspace, WorkspaceMember } from '@/types/database';

interface WorkspaceContextValue {
  /** The current active workspace */
  workspace: Workspace | null;
  /** Convenience accessors */
  workspace_id: string | null;
  plan_tier: Workspace['plan'] | null;
  credit_balance: number;
  /** All members of the current workspace */
  members: WorkspaceMember[];
  /** The current user's membership record */
  membership: WorkspaceMember | null;
  /** Loading state while workspace is being fetched */
  loading: boolean;
  /** Error message if user has no workspace */
  error: string | null;
  /** Re-fetch workspace data (e.g. after credit deduction) */
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, workspace, membership, loading: authLoading, refreshWorkspace, authGeneration } = useAuth();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Separate credit balance state — updated locally from realtime events
  // without creating a new workspace object reference. This prevents
  // credit deductions from cascading re-renders across the entire app.
  const [creditOverride, setCreditOverride] = useState<number | null>(null);
  // Counter to force realtime channel re-subscription on visibility recovery
  const [realtimeGeneration, setRealtimeGeneration] = useState(0);

  // Use a stable ref for the Supabase client — calling createBrowserClient()
  // in the render body returns the same singleton, but using a ref makes the
  // stability explicit and avoids lint warnings about unstable deps.
  const supabaseRef = useRef(createBrowserClient());
  const supabase = supabaseRef.current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch workspace members when workspace changes.
  // Falls back to server API if direct query fails (RLS issues).
  const fetchMembers = useCallback(async (workspaceId: string) => {
    setMembersLoading(true);
    try {
      // Try direct Supabase query first (fast path)
      // Try with status filter; if it fails (column missing), retry without it
      let directData: WorkspaceMember[] | null = null;
      let directError: { message: string } | null = null;

      const firstAttempt = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (firstAttempt.error) {
        // Status column may not exist — retry without filter
        const fallback = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId);
        directData = fallback.data as WorkspaceMember[] | null;
        directError = fallback.error;
      } else {
        directData = firstAttempt.data as WorkspaceMember[] | null;
        directError = firstAttempt.error;
      }

      if (!directError && directData && directData.length > 0) {
        setMembers(directData);
        return;
      }

      if (directError) {
        console.warn('fetchMembers: direct query failed, falling back to API', directError.message);
      }

      // Fallback: use server API to load (bypasses RLS)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/workspace/load', { method: 'POST', headers });
        if (res.ok) {
          const apiData = await res.json();
          const wsMembers = (apiData.members ?? [])
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
            }));
          setMembers(wsMembers as WorkspaceMember[]);
          return;
        }
      } catch (apiErr) {
        console.error('fetchMembers: API fallback also failed', apiErr);
      }

      // Both paths failed
      setMembers(directData ?? []);
    } finally {
      setMembersLoading(false);
    }
  }, [supabase]);

  // Load members when workspace changes
  useEffect(() => {
    if (workspace?.id) {
      setError(null);
      fetchMembers(workspace.id);
    } else if (!authLoading && user && !workspace) {
      // User is authenticated but has no workspace — shouldn't happen with B-009
      setError('No workspace found. Please contact support.');
      setMembers([]);
    }
  }, [workspace?.id, authLoading, user, workspace, fetchMembers]);

  // Subscribe to realtime changes on the current workspace row.
  // IMPORTANT: Credit balance changes happen on every chat message. We handle
  // them locally from the realtime payload to avoid a full refreshWorkspace()
  // call that would create a new workspace object, cascading re-renders across
  // the entire app (dashboards, health, chat all depend on workspace context).
  useEffect(() => {
    if (!workspace?.id) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const workspaceId = workspace.id;
    const channel = supabase
      .channel(`workspace-${workspaceId}-${realtimeGeneration}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          // Only do a full refresh if something structural changed (name, plan,
          // settings, clickup_connected, etc.). Credit balance and updated_at
          // changes are applied locally without creating a new workspace object.
          const current = workspace;
          const creditOnly =
            updated.credit_balance !== current.credit_balance &&
            updated.name === current.name &&
            updated.plan === current.plan &&
            updated.slug === current.slug &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updated.clickup_connected === (current as any).clickup_connected;

          if (creditOnly) {
            // Apply credit balance locally — no new object reference, no cascade
            setCreditOverride(typeof updated.credit_balance === 'number' ? updated.credit_balance : null);
          } else {
            // Structural change — full refresh needed
            refreshWorkspace();
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workspace object used for comparison, but we only want to re-subscribe on ID change; realtimeGeneration forces re-subscribe on visibility recovery
  }, [workspace?.id, supabase, refreshWorkspace, realtimeGeneration]);

  // Re-fetch on session recovery (stale token was refreshed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRecovered = () => {
      refreshWorkspace();
      if (workspace?.id) fetchMembers(workspace.id);
    };
    window.addEventListener(SESSION_RECOVERED_EVENT, handleRecovered);
    return () => window.removeEventListener(SESSION_RECOVERED_EVENT, handleRecovered);
  }, [refreshWorkspace, workspace?.id, fetchMembers]);

  // Reconnect realtime + refetch when AuthProvider signals a token refresh
  // or sign-in via authGeneration. This replaces a direct onAuthStateChange
  // subscription, ensuring ordered recovery: auth first, then children.
  const authGenRef = useRef(authGeneration);
  useEffect(() => {
    // Skip the initial mount — only react to actual changes
    if (authGenRef.current === authGeneration) return;
    authGenRef.current = authGeneration;

    refreshWorkspace();
    if (workspace?.id) fetchMembers(workspace.id);
    // Force realtime channel re-subscription with new credentials
    setRealtimeGeneration((g: number) => g + 1);
  }, [authGeneration, refreshWorkspace, workspace?.id, fetchMembers]);

  // Re-subscribe realtime channel + refresh when tab becomes visible
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      setRealtimeGeneration((g: number) => g + 1);
      refreshWorkspace();
      if (workspace?.id) fetchMembers(workspace.id);
    };
    window.addEventListener(VISIBILITY_RECOVERED_EVENT, handleVisibility);
    return () => window.removeEventListener(VISIBILITY_RECOVERED_EVENT, handleVisibility);
  }, [refreshWorkspace, workspace?.id, fetchMembers]);

  // Combined refetch: refresh workspace data + members
  const refetch = useCallback(async () => {
    await Promise.all([
      refreshWorkspace(),
      workspace?.id ? fetchMembers(workspace.id) : Promise.resolve(),
    ]);
  }, [refreshWorkspace, workspace?.id, fetchMembers]);

  // Only block rendering on auth loading, not member fetching.
  // Members loading in the background prevents the "stuck skeleton" issue
  // where pages wait for the full member list before showing any content.
  const loading = authLoading;

  // Reset credit override when the workspace object itself changes (full refresh)
  useEffect(() => {
    setCreditOverride(null);
  }, [workspace]);

  const value: WorkspaceContextValue = {
    workspace,
    workspace_id: workspace?.id ?? null,
    plan_tier: workspace?.plan ?? null,
    // Use local credit override when available (from realtime events),
    // otherwise fall back to the workspace object's value.
    credit_balance: creditOverride ?? workspace?.credit_balance ?? 0,
    members,
    membership,
    loading,
    error,
    refetch,
  };

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
