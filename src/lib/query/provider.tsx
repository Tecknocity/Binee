'use client';

import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

/**
 * Ensures the Supabase session is fresh BEFORE React Query refetches.
 *
 * Without this, refetchOnWindowFocus fires queries with an expired JWT.
 * Supabase RLS silently returns empty arrays (not errors) for expired tokens,
 * so React Query overwrites the cache with empty data — blanking the UI.
 *
 * By calling getUser() first (which auto-refreshes the token), we guarantee
 * queries always run with a valid JWT.
 */
function setupFocusRefresh() {
  if (typeof window === 'undefined') return;

  const supabase = createBrowserClient();

  focusManager.setEventListener((handleFocus) => {
    const onFocus = async () => {
      await supabase.auth.getUser();
      handleFocus(true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onFocus();
      } else {
        handleFocus(false);
      }
    };

    window.addEventListener('visibilitychange', onVisibilityChange, false);
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });

  onlineManager.setEventListener((setOnline) => {
    const onOnline = async () => {
      await supabase.auth.getUser();
      setOnline(true);
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
    setupFocusRefresh();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
