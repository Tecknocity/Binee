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
// Hook — shared ClickUp connection status checker
// ---------------------------------------------------------------------------

export function useClickUpStatus(): ClickUpConnectionStatus & {
  refetch: () => Promise<void>;
} {
  const [status, setStatus] = useState<ClickUpConnectionStatus>({
    connected: false,
    teamName: null,
    loading: true,
  });

  const fetchStatus = useCallback(async () => {
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
    fetchStatus();
  }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
}
