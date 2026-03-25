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
    _browserClient = createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
  return _browserClient;
}
