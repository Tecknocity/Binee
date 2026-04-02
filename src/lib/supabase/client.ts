import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _browserClient: SupabaseClient<any, any, any> | null = null;

// In-memory mutex that serializes token refresh operations.
// Supabase's GoTrue uses refresh-token rotation: each refresh invalidates the
// previous token.  The browser Web Locks API was causing "Lock not released
// within 5000ms" → AbortError, so we replaced it with a simple promise-queue
// mutex.  Unlike the previous no-op bypass (which allowed concurrent refreshes
// that permanently broke sessions), this ensures only one refresh runs at a
// time while avoiding the Web Locks timeout issue.
//
// IMPORTANT: respects acquireTimeout to prevent deadlocks. If a previous
// refresh hangs (e.g. network died while tab was inactive), the next caller
// will break the deadlock after the timeout instead of waiting forever.
const authLock: <R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
) => Promise<R> = (() => {
  let pending: Promise<unknown> = Promise.resolve();
  return async <R>(
    _name: string,
    acquireTimeout: number,
    fn: () => Promise<R>,
  ): Promise<R> => {
    const release = pending;
    let resolve: () => void;
    pending = new Promise<void>((r) => {
      resolve = r;
    });
    // Wait for previous operation, but with a timeout to prevent deadlocks.
    // If the previous refresh hung (e.g. tab was inactive and network request
    // was killed by the browser), this breaks the deadlock instead of freezing
    // all subsequent Supabase operations forever.
    const timeout = acquireTimeout > 0 ? acquireTimeout : 5000;
    try {
      await Promise.race([
        release,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Auth lock timeout')), timeout),
        ),
      ]);
    } catch {
      // Lock timed out — proceed anyway to avoid deadlock.
      // The worst case is two concurrent refreshes, which may cause one to
      // fail (refresh token already used). Supabase will retry on the next
      // request, which is better than permanently freezing the app.
      console.warn('[binee:auth] Lock acquisition timed out, breaking deadlock');
    }
    try {
      return await fn();
    } finally {
      resolve!();
    }
  };
})();

export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables',
    );
  }
  if (!_browserClient) {
    _browserClient = createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        lock: authLock,
      },
    });
  }
  return _browserClient;
}
