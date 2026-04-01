'use client';

import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { invalidateBillingCache } from '@/billing/hooks/billing-cache';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: 'always',
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

let setupDone = false;

/**
 * Refresh the Supabase token, then notify React Query that focus/online changed.
 *
 * Why: Supabase RLS returns empty arrays (not errors) for expired JWTs.
 * If React Query refetches before the token is refreshed, the empty result
 * overwrites the cache and blanks the UI. By awaiting getUser() first
 * (which auto-refreshes if expired), queries always run with a valid token.
 */
function setupRefreshBeforeRefetch() {
  if (typeof window === 'undefined' || setupDone) return;
  setupDone = true;

  const supabase = createBrowserClient();

  async function ensureFreshToken() {
    try {
      await supabase.auth.getUser();
    } catch {
      // Token refresh failed — still notify React Query so it can retry
    }
    // Invalidate billing cache (it's outside React Query)
    invalidateBillingCache();
  }

  // Override React Query's default focus listener.
  // Default only listens to visibilitychange; we add window.focus too,
  // and refresh the Supabase token before triggering refetches.
  focusManager.setEventListener((handleFocus) => {
    const onVisible = () => {
      ensureFreshToken().then(() => handleFocus(true));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onVisible();
      } else {
        handleFocus(false);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange, false);
    window.addEventListener('focus', onVisible, false);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisible);
    };
  });

  onlineManager.setEventListener((setOnline) => {
    const onOnline = () => {
      ensureFreshToken().then(() => setOnline(true));
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline, false);
    window.addEventListener('offline', onOffline, false);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    setupRefreshBeforeRefetch();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
