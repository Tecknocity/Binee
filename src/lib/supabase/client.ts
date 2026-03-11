import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createServerClient as createServerSupabaseClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export function createBrowserClient() {
  return createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createServerSupabaseClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // This can be ignored in Server Components where cookies are read-only
        }
      },
    },
  });
}

export { supabaseUrl, supabaseAnonKey };
