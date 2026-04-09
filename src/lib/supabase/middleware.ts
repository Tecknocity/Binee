import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Clean up stale Supabase auth cookie chunks that accumulate over time.
  // When @supabase/ssr re-chunks cookies (e.g., token refresh shrinks the JWT),
  // old higher-numbered chunks may linger, inflating the Cookie header until
  // Vercel rejects it with 494 REQUEST_HEADER_TOO_LARGE.
  const allCookies = request.cookies.getAll();
  const supabaseCookieNames = allCookies
    .map((c) => c.name)
    .filter((name) => name.startsWith('sb-') && /\.\d+$/.test(name));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );

        // After Supabase sets its cookies, expire any stale chunks that
        // were NOT included in the new setAll batch. This prevents
        // orphaned high-index chunks from inflating headers.
        const freshNames = new Set(cookiesToSet.map((c) => c.name));
        for (const staleName of supabaseCookieNames) {
          if (!freshNames.has(staleName)) {
            supabaseResponse.cookies.set(staleName, '', { maxAge: 0 });
          }
        }
      },
    },
  });

  // Refresh the session and check auth state for route protection
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password';
  const isPublicPath = pathname === '/' || pathname.startsWith('/api/') || isAuthPage;

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthPage) {
    const chatUrl = request.nextUrl.clone();
    chatUrl.pathname = '/chat';
    return NextResponse.redirect(chatUrl);
  }

  return supabaseResponse;
}
