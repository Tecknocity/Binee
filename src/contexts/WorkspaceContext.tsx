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
  const { user, workspace, membership, loading: authLoading, refreshWorkspace } = useAuth();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch workspace members when workspace changes
  const fetchMembers = useCallback(async (workspaceId: string) => {
    setMembersLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (fetchError) {
        console.error('Failed to fetch workspace members:', fetchError);
        return;
      }
      setMembers((data as WorkspaceMember[]) ?? []);
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

  // Subscribe to realtime changes on the current workspace row (credit_balance, etc.)
  useEffect(() => {
    if (!workspace?.id) return;

    // Clean up previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`workspace-${workspace.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspace.id}`,
        },
        () => {
          // Refresh workspace data when any update occurs (credit balance, settings, etc.)
          refreshWorkspace();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspace?.id, supabase, refreshWorkspace]);

  // Combined refetch: refresh workspace data + members
  const refetch = useCallback(async () => {
    await refreshWorkspace();
    if (workspace?.id) {
      await fetchMembers(workspace.id);
    }
  }, [refreshWorkspace, workspace?.id, fetchMembers]);

  const loading = authLoading || membersLoading;

  const value: WorkspaceContextValue = {
    workspace,
    workspace_id: workspace?.id ?? null,
    plan_tier: workspace?.plan ?? null,
    credit_balance: workspace?.credit_balance ?? 0,
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
