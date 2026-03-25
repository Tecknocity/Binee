import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Extract authenticated user ID from a Next.js API request.
 * Checks Authorization header first, then falls back to cookies.
 */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Try Bearer token first
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    if (!error && data?.user) return data.user.id;
  }

  // Fall back to cookies
  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
  const { data, error } = await authClient.auth.getUser();
  if (!error && data?.user) return data.user.id;

  return null;
}
