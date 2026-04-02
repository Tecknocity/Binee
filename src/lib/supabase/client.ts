import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _browserClient: SupabaseClient<any, any, any> | null = null;

export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables',
    );
  }
  if (!_browserClient) {
    // CRITICAL: Bypass navigator.locks entirely.
    //
    // The default Supabase auth uses navigator.locks (Web Locks API) to
    // serialize token refreshes across tabs. However, when a tab goes to
    // the background and returns, navigator.locks can deadlock — the lock
    // held by the background tab is never released, causing ALL Supabase
    // queries to hang indefinitely (the "Loading conversation..." bug).
    //
    // Token refresh is idempotent — refreshing the same token from two tabs
    // simultaneously just produces the same new token. The lock is a
    // micro-optimization, not a correctness requirement. Disabling it
    // eliminates the deadlock entirely.
    _browserClient = createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lock: (async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
          // No-op lock: just run the function directly.
          // This prevents navigator.locks deadlocks on background tabs.
          return await fn();
        }) as any,
      },
    });
  }
  return _browserClient;
}
