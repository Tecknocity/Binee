'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClickUpConnectionStatus {
  connected: boolean;
  teamName: string | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Hook — shared ClickUp connection status checker
//
// Uses workspace object for instant status (no network call), then
// optionally refreshes from the API in the background.
// ---------------------------------------------------------------------------

export function useClickUpStatus(): ClickUpConnectionStatus & {
  refetch: () => Promise<void>;
} {
  const { workspace_id, workspace, loading: workspaceLoading } = useWorkspace();

  // Derive status synchronously from workspace object (instant, no API call).
  // This eliminates the network round-trip that was blocking page rendering.
  const connected = !!workspace?.clickup_team_id;
  const teamName = workspace?.clickup_team_name ?? null;

  const [status, setStatus] = useState<ClickUpConnectionStatus>({
    connected,
    teamName,
    loading: workspaceLoading,
  });

  // Update status synchronously whenever workspace data changes
  useEffect(() => {
    setStatus({
      connected: !!workspace?.clickup_team_id,
      teamName: workspace?.clickup_team_name ?? null,
      loading: workspaceLoading,
    });
  }, [workspace?.clickup_team_id, workspace?.clickup_team_name, workspaceLoading]);

  // Explicit refetch via API (for manual refresh scenarios)
  const refetch = useCallback(async () => {
    if (!workspace_id) {
      setStatus({ connected: false, teamName: null, loading: false });
      return;
    }

    try {
      const res = await fetch(`/api/clickup/status?workspace_id=${encodeURIComponent(workspace_id)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          loading: false,
        });
      }
    } catch {
      // Keep current status on error
    }
  }, [workspace_id]);

  return { ...status, refetch };
}
