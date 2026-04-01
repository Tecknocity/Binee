'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { SESSION_RECOVERED_EVENT } from '@/hooks/useSessionKeepalive';

/**
 * Refreshes the client-side Supabase session on every route change.
 *
 * Why: The middleware refreshes the server-side session (cookies) on every
 * navigation, but the browser Supabase client holds a stale token in memory.
 * This hook syncs the client with the fresh cookies after each route change,
 * then dispatches SESSION_RECOVERED_EVENT so data-fetching contexts re-fetch.
 */
export function useRouteSessionRefresh() {
  const pathname = usePathname();
  const supabase = createBrowserClient();

  useEffect(() => {
    let cancelled = false;

    async function refreshSession() {
      try {
        // 1. getSession() re-reads auth state from cookies (set by middleware)
        //    and updates the in-memory token cache. This is critical because
        //    getUser() alone does NOT update the in-memory session.
        const { data: { session: before } } = await supabase.auth.getSession();

        // 2. getUser() validates the token with the Supabase Auth server.
        //    If the token is near expiry, this triggers an auto-refresh.
        const { data: { user }, error } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!error && user) {
          // Check if the token actually changed (middleware refreshed it)
          const { data: { session: after } } = await supabase.auth.getSession();
          if (after?.access_token !== before?.access_token) {
            // Token was refreshed — notify contexts to re-fetch data
            window.dispatchEvent(new CustomEvent(SESSION_RECOVERED_EVENT));
          }
        }
      } catch (err) {
        console.warn('[route-refresh] Session refresh on route change failed:', err);
      }
    }

    refreshSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, supabase]);
}
