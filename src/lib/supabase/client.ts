import { createClient } from '@supabase/supabase-js';
import { createServerClient as createServerSupabaseClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

/**
 * Admin client using service role key — bypasses RLS.
 * Use only in server-side contexts (API routes, cron jobs).
 */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Server client using anon key + user cookies — respects RLS.
 * Use in API routes that need to act on behalf of the authenticated user.
 */
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
          // Can be ignored in read-only contexts
        }
      },
    },
  });
}

export { supabaseUrl, supabaseAnonKey };
