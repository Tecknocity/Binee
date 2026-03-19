import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { acceptInvitation } from '@/lib/workspace/invitations';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/chat';

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers.get('cookie')
              ?.split('; ')
              .map((c) => {
                const [name, ...rest] = c.split('=');
                return { name, value: rest.join('=') };
              }) ?? [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Auto-accept any pending invitations for this user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await acceptInvitation(user.id, user.email);
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
