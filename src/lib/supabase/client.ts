import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createBrowserClient() {
  return createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export { supabaseUrl, supabaseAnonKey };
