'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Creates a QueryClient with defaults tuned for a Supabase-backed SPA:
 *
 * - staleTime 2 min: data is considered fresh for 2 minutes (no refetch on re-mount).
 * - gcTime 10 min: inactive query data stays in cache for 10 minutes.
 *   This means navigating away and back shows cached data instantly.
 * - refetchOnWindowFocus OFF: we handle focus recovery ourselves in
 *   useSessionKeepalive (token-first ordering — validate token before refetching).
 * - refetchOnReconnect: refetch when network comes back.
 * - retry 1: one automatic retry on failure with exponential backoff.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create the QueryClient once per component lifetime (survives re-renders).
  // useState with initializer function ensures it's only created on mount.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
