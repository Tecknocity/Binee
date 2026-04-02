'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// Standard React Query setup — no custom overrides.
//
// Tab recovery works via built-in defaults:
// - refetchOnWindowFocus: true → React Query refetches stale queries on tab return
// - Supabase auth auto-refreshes tokens internally (no manual getSession needed)
// - Supabase Realtime auto-reconnects WebSockets
//
// No custom focusManager, no visibilitychange listeners, no orchestrators.
// This is how Claude, Linear, Notion, and every standard SaaS handles it.

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

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
