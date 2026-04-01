'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { invalidateBillingCache } from '@/billing/hooks/billing-cache';

/**
 * Custom event dispatched AFTER the token has been validated/refreshed.
 * All data hooks listen for this instead of running their own visibility handlers.
 *
 * Detail payload:
 *   - reason: what triggered the recovery ('visibility-change' | 'network-online' | 'periodic')
 */
export const SESSION_RECOVERED_EVENT = 'binee:session-recovered';

const HEALTH_CHECK_INTERVAL = 3 * 60_000; // 3 minutes
const VISIBILITY_THRESHOLD = 10_000; // 10 seconds

/**
 * THE session recovery hook. This is the ONLY place that:
 *   1. Listens to visibilitychange
 *   2. Listens to online
 *   3. Runs periodic health checks
 *
 * Recovery flow (sequential, not parallel):
 *   1. Validate token via getUser() — this is a server call that auto-refreshes
 *   2. If getUser() fails, explicitly call refreshSession()
 *   3. If token is now valid: invalidate billing cache + React Query caches
 *   4. Dispatch SESSION_RECOVERED_EVENT so hooks that use direct state (not RQ)
 *      can reload their data (AuthProvider workspace state, useChat messages)
 *
 * No other hook should listen to visibilitychange or online for auth recovery.
 */
export function useSessionKeepalive() {
  const supabaseRef = useRef(
    typeof window !== 'undefined' ? createBrowserClient() : null,
  );
  const queryClient = useQueryClient();
  const lastHiddenRef = useRef<number>(0);
  const checkingRef = useRef(false);

  const validateAndRecover = useCallback(async (reason: string) => {
    const supabase = supabaseRef.current;
    if (!supabase || checkingRef.current) return;

    checkingRef.current = true;
    try {
      // Step 1: Validate token (server call — auto-refreshes if stale)
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Step 2: Explicit refresh as fallback
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn(`[keepalive] ${reason}: session refresh failed — user may need to re-login`);
          return; // Don't dispatch recovery if we can't get a valid token
        }
      }

      // Step 3: Token is now valid. Invalidate all caches.
      // Billing uses its own cache outside React Query — invalidate it first.
      invalidateBillingCache();
      // React Query invalidation triggers all useQuery hooks to refetch
      // with the now-valid token.
      queryClient.invalidateQueries();

      // Step 4: Dispatch event for non-React-Query state holders.
      // AuthProvider needs to reload workspace state (plain useState).
      // useChat needs to reload messages for the active conversation.
      // WorkspaceContext/useConversations need to reconnect realtime channels.
      window.dispatchEvent(
        new CustomEvent(SESSION_RECOVERED_EVENT, { detail: { reason } }),
      );
    } catch (err) {
      console.warn(`[keepalive] ${reason}: recovery failed`, err);
    } finally {
      checkingRef.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const awayMs = Date.now() - lastHiddenRef.current;
        if (awayMs >= VISIBILITY_THRESHOLD) {
          validateAndRecover('visibility-change');
        }
      }
    };

    const handleOnline = () => {
      validateAndRecover('network-online');
    };

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        validateAndRecover('periodic');
      }
    }, HEALTH_CHECK_INTERVAL);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [validateAndRecover]);
}
