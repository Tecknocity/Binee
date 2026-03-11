'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClickUpConnectionStatus {
  connected: boolean;
  teamName: string | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Demo mode — assume ClickUp is always connected.
// TODO: Remove this flag once real ClickUp OAuth integration is complete.
// ---------------------------------------------------------------------------
const DEMO_MODE = true;

// ---------------------------------------------------------------------------
// Hook — shared ClickUp connection status checker
// ---------------------------------------------------------------------------

export function useClickUpStatus(): ClickUpConnectionStatus & {
  refetch: () => Promise<void>;
} {
  const [status, setStatus] = useState<ClickUpConnectionStatus>(
    DEMO_MODE
      ? { connected: true, teamName: 'Demo Workspace', loading: false }
      : { connected: false, teamName: null, loading: true },
  );

  const fetchStatus = useCallback(async () => {
    if (DEMO_MODE) return;

    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/clickup/status');
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.teamName ?? null,
          loading: false,
        });
      } else {
        setStatus({ connected: false, teamName: null, loading: false });
      }
    } catch {
      setStatus({ connected: false, teamName: null, loading: false });
    }
  }, []);

  useEffect(() => {
    if (!DEMO_MODE) fetchStatus();
  }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
}
