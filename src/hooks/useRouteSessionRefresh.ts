'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

/**
 * Refreshes the client-side Supabase session on every route change.
 *
 * Why: The middleware refreshes the server-side session (cookies) on every
 * navigation, but the browser Supabase client holds a stale token in memory.
 * This hook syncs the client with the fresh cookies after each route change.
 */
export function useRouteSessionRefresh() {
  const pathname = usePathname();
  const supabase = createBrowserClient();

  useEffect(() => {
    // getUser() forces the client to validate against the server
    // and pick up the refreshed token from cookies
    supabase.auth.getUser().catch((err) => {
      console.warn('[route-refresh] Session refresh on route change failed:', err);
    });
  }, [pathname, supabase]);
}
