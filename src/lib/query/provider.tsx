'use client';

import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { invalidateBillingCache } from '@/billing/hooks/billing-cache';

/**
 * SESSION RECOVERY — Single Orchestrator
 *
 * This is the ONE place in the entire app that handles tab-return recovery.
 * No other file should have a visibilitychange or focus listener.
 *
 * Flow:
 * 1. User returns to tab → visibilitychange fires
 * 2. We call getSession() to ensure auth token is still valid
 *    (Supabase auto-refreshes if needed — this is a no-op for short switches)
 * 3. Only AFTER auth is confirmed → we tell React Query "focus is back"
 * 4. React Query refetches all stale queries (conversations, workspace, etc.)
 * 5. We also invalidate the billing cache so credits refresh on next read
 * 6. We dispatch a custom event so useChat can reload messages (it uses
 *    local state, not React Query)
 *
 * For short tab switches (< 1 hour): getSession() returns instantly from
 * memory, no network call. Everything just works.
 *
 * For long tab switches (> 1 hour): getSession() triggers a token refresh,
 * then React Query refetches with the fresh token. No empty arrays from RLS.
 */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        // Disabled — we control focus notification manually in setupSessionRecovery
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

// Custom event dispatched after auth is confirmed on tab return.
// useChat listens for this to reload messages (since messages use local state).
export const SESSION_READY_EVENT = 'binee:session-ready';

let setupDone = false;

function setupSessionRecovery() {
  if (typeof window === 'undefined' || setupDone) return;
  setupDone = true;

  const supabase = createBrowserClient();

  // Override React Query's focus detection so we control when it fires.
  // We replace the default listener with our own that gates on auth.
  focusManager.setEventListener((handleFocus) => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      // Step 1: Ensure auth is valid. getSession() reads from memory if
      // the token is still valid (instant, no network call). If expired,
      // Supabase auto-refreshes the token before returning.
      try {
        await supabase.auth.getSession();
      } catch {
        // Auth refresh failed — still proceed so the UI doesn't freeze.
        // Queries will fail with auth errors and React Query will retry.
      }

      // Step 2: Invalidate billing cache (it's outside React Query)
      invalidateBillingCache();

      // Step 3: Tell React Query "focus is back" — this triggers refetch
      // of all stale queries (conversations, workspace members, etc.)
      handleFocus(true);

      // Step 4: Notify useChat to reload messages (local state, not RQ)
      window.dispatchEvent(new Event(SESSION_READY_EVENT));
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    setupSessionRecovery();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
