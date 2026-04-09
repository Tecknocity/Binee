import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Estimate the total size of cookie headers on the request.
 * Vercel rejects requests when headers exceed 16KB per header or 32KB total.
 * We check early so we can clear cookies before Vercel returns a 494.
 */
function estimateCookieHeaderSize(request: NextRequest): number {
  const cookieHeader = request.headers.get('cookie') ?? '';
  // The "Cookie: " prefix itself is ~8 bytes, but we care about the value
  return cookieHeader.length;
}

/**
 * Build a response that expires all Supabase auth cookies and redirects
 * the user to /clear-session.html (a static page that also clears
 * localStorage/sessionStorage auth data).
 */
function buildCookieClearResponse(request: NextRequest): NextResponse {
  const clearUrl = request.nextUrl.clone();
  clearUrl.pathname = '/clear-session.html';
  const response = NextResponse.redirect(clearUrl);

  // Expire every sb-* cookie (Supabase auth chunks)
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
    }
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  // --- Cookie size guard ---
  // Vercel's 494 fires at ~16KB per header. We bail at 12KB to leave
  // headroom for other headers the browser sends (User-Agent, etc.).
  const cookieSize = estimateCookieHeaderSize(request);
  if (cookieSize > 12_000) {
    console.warn(
      `[middleware] Cookie header is ${cookieSize} bytes - clearing to prevent 494`,
    );
    return buildCookieClearResponse(request);
  }

  let supabaseResponse = NextResponse.next({ request });

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
