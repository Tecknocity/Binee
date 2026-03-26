'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';

/**
 * Thin client-component wrapper so the root layout (server component)
 * can include AuthProvider. Having a single AuthProvider at the root
 * prevents duplicate auth initialization when navigating between
 * the (auth) and (app) route groups.
 */
export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
