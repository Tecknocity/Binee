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
// ---------------------------------------------------------------------------

export function useClickUpStatus(): ClickUpConnectionStatus & {
  refetch: () => Promise<void>;
} {
  const { workspace_id, workspace } = useWorkspace();
  const [status, setStatus] = useState<ClickUpConnectionStatus>({
    connected: false,
    teamName: null,
    loading: true,
  });

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- useCallback deps intentionally include workspace object fields for fallback
  const fetchStatus = useCallback(async () => {
    if (!workspace_id) {
      setStatus({ connected: false, teamName: null, loading: false });
      return;
    }

    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/clickup/status?workspace_id=${encodeURIComponent(workspace_id)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          loading: false,
        });
      } else {
        // Fallback: check workspace object directly
        setStatus({
          connected: !!workspace?.clickup_team_id,
          teamName: workspace?.clickup_team_name ?? null,
          loading: false,
        });
      }
    } catch {
      // Fallback: check workspace object directly
      setStatus({
        connected: !!workspace?.clickup_team_id,
        teamName: workspace?.clickup_team_name ?? null,
        loading: false,
      });
    }
  }, [workspace_id, workspace?.clickup_team_id, workspace?.clickup_team_name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchStatus is an async data fetch that sets state on completion
    fetchStatus();
  }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
}
