'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Interval between periodic session health checks (ms).
 * Checks run only when the tab is visible.
 */
const HEALTH_CHECK_INTERVAL = 3 * 60_000; // 3 minutes

/**
 * Minimum time (ms) the tab must be hidden before we run a full
 * session validation + query invalidation on return. Quick alt-tabs
 * (<10s) skip the heavy recovery path.
 */
const VISIBILITY_THRESHOLD = 10_000; // 10 seconds

/**
 * Keeps the Supabase session alive and invalidates React Query caches
 * when the session recovers. This is the ONLY place that handles
 * visibility-change recovery — individual hooks no longer need their
 * own listeners.
 *
 * Flow on tab return (after threshold):
 *   1. Validate token via getUser() (server call — auto-refreshes if needed)
 *   2. If token was stale, call refreshSession() as fallback
 *   3. Invalidate all React Query caches → data hooks refetch with fresh token
 *
 * This ordering (token first, then refetch) is critical. If we refetched
 * first, the stale token would cause RLS to return empty rows.
 */
export function useSessionKeepalive() {
  const supabaseRef = useRef(
    typeof window !== 'undefined' ? createBrowserClient() : null,
  );
  const queryClient = useQueryClient();
  const lastHiddenRef = useRef<number>(0);
  const checkingRef = useRef(false);

  const validateAndInvalidate = useCallback(async (reason: string) => {
    const supabase = supabaseRef.current;
    if (!supabase || checkingRef.current) return;

    checkingRef.current = true;
    try {
      // getUser() makes a server call that validates AND refreshes the token,
      // unlike getSession() which only returns the cached (possibly stale) value.
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Token is invalid — attempt explicit refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn(`[keepalive] ${reason}: refresh failed`, refreshError.message);
          return;
        }
        console.info(`[keepalive] ${reason}: session refreshed`);
      }

      // Token is now valid — invalidate all caches so hooks refetch with fresh token
      queryClient.invalidateQueries();
    } catch (err) {
      console.warn(`[keepalive] ${reason}: check failed`, err);
    } finally {
      checkingRef.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // --- Visibility change: validate token + invalidate caches ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const awayMs = Date.now() - lastHiddenRef.current;
        if (awayMs >= VISIBILITY_THRESHOLD) {
          validateAndInvalidate('visibility-change');
        }
      }
    };

    // --- Online: validate when network returns ---
    const handleOnline = () => {
      validateAndInvalidate('network-online');
    };

    // --- Periodic: health check every 3 minutes ---
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        validateAndInvalidate('periodic');
      }
    }, HEALTH_CHECK_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [validateAndInvalidate]);
}
