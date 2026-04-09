'use client';

import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClickUpConnectionStatus {
  connected: boolean;
  teamName: string | null;
  planTier: string;
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

  // Override state — only set when an explicit refetch returns fresh data
  const [override, setOverride] = useState<ClickUpConnectionStatus | null>(null);

  // Derive status synchronously from workspace object (instant, no API call).
  // This eliminates the network round-trip that was blocking page rendering.
  const derived = useMemo<ClickUpConnectionStatus>(() => ({
    connected: !!workspace?.clickup_team_id,
    teamName: workspace?.clickup_team_name ?? null,
    planTier: workspace?.clickup_plan_tier ?? 'free',
    loading: workspaceLoading,
  }), [workspace?.clickup_team_id, workspace?.clickup_team_name, workspace?.clickup_plan_tier, workspaceLoading]);

  // Use override if available, otherwise use derived state
  const status = override ?? derived;

  // Explicit refetch via API (for manual refresh scenarios)
  const refetch = useCallback(async () => {
    if (!workspace_id) {
      setOverride({ connected: false, teamName: null, planTier: 'free', loading: false });
      return;
    }

    try {
      const res = await fetch(`/api/clickup/status?workspace_id=${encodeURIComponent(workspace_id)}`);
      if (res.ok) {
        const data = await res.json();
        setOverride({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          planTier: data.plan_tier ?? 'free',
          loading: false,
        });
      }
    } catch (err) {
      console.error('Failed to refetch ClickUp status:', err);
    }
  }, [workspace_id]);

  return { ...status, refetch };
}
