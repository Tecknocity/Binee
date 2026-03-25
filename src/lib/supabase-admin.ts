import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase admin client (service role — bypasses RLS).
 * Used by billing lifecycle handlers, cron jobs, and server-side operations.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  return createClient(url, serviceKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdmin: SupabaseClient<any, any, any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin: SupabaseClient<any, any, any> = new Proxy(
  {} as SupabaseClient<any, any, any>,
  {
    get(_target, prop) {
      if (!_supabaseAdmin) {
        _supabaseAdmin = getSupabaseAdmin();
      }
      return (_supabaseAdmin as unknown as Record<string | symbol, unknown>)[prop];
    },
  },
);
