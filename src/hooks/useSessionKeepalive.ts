'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Interval between periodic session health checks (ms).
 * Checks run only when the tab is visible.
 */
const HEALTH_CHECK_INTERVAL = 3 * 60_000; // 3 minutes

/**
 * Custom event dispatched when the session is recovered after being stale.
 * Other hooks/contexts listen for this to re-fetch their data.
 */
export const SESSION_RECOVERED_EVENT = 'binee:session-recovered';

/**
 * Dispatches a custom event to notify the app that the session was recovered.
 * Listeners (dashboard cache, workspace context, etc.) should re-fetch data.
 */
function dispatchSessionRecovered() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_RECOVERED_EVENT));
  }
}

/**
 * Hook that keeps the Supabase auth session alive by:
 * 1. Running a periodic health check (getUser) every 3 minutes
 * 2. Re-validating the session when the tab becomes visible after being hidden
 * 3. Dispatching a SESSION_RECOVERED_EVENT when a stale session is refreshed
 *
 * Should be mounted once, high in the component tree (e.g. in AuthProvider).
 */
export function useSessionKeepalive() {
  const supabaseRef = useRef(
    typeof window !== 'undefined' ? createBrowserClient() : null,
  );
  const lastCheckRef = useRef(Date.now());
  const checkingRef = useRef(false);

  const validateSession = useCallback(async (reason: string) => {
    const supabase = supabaseRef.current;
    if (!supabase || checkingRef.current) return;

    checkingRef.current = true;
    try {
      // getUser() makes a server call that validates & refreshes the token,
      // unlike getSession() which only returns the cached (possibly stale) value.
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Token is invalid — attempt an explicit refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn(`[SessionKeepalive] ${reason}: refresh failed`, refreshError.message);
          // Don't force sign-out — let the user continue on cached data.
          // The next page navigation will trigger middleware which redirects to /login if needed.
          return;
        }
        // Refresh succeeded — notify the app to re-fetch data
        console.info(`[SessionKeepalive] ${reason}: session refreshed successfully`);
        dispatchSessionRecovered();
      }

      lastCheckRef.current = Date.now();
    } catch (err) {
      console.warn(`[SessionKeepalive] ${reason}: check failed`, err);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // --- Visibility change handler ---
    // When the tab becomes visible after being hidden, validate the session.
    // Browsers throttle background tabs, which can kill WebSocket connections
    // and prevent Supabase's auto-refresh from running.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastCheckRef.current;
        // Only check if at least 1 minute has passed since last check
        if (elapsed > 60_000) {
          validateSession('visibility-change');
        }
      }
    };

    // --- Online handler ---
    // When network connectivity is restored, validate the session.
    const handleOnline = () => {
      validateSession('network-online');
    };

    // --- Periodic health check ---
    const intervalId = setInterval(() => {
      // Only check when the tab is visible to avoid wasting resources
      if (document.visibilityState === 'visible') {
        validateSession('periodic');
      }
    }, HEALTH_CHECK_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [validateSession]);
}
