import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { acceptInvitation } from '@/lib/workspace/invitations';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Auto-accept any pending invitations for this user's email
        if (user.email) {
          await acceptInvitation(user.id, user.email);
        }

        // Trim user_metadata to prevent JWT cookie bloat (Vercel 494).
        // OAuth providers (Google) dump a lot of profile data into
        // user_metadata. We keep only what the app reads.
        try {
          const meta = user.user_metadata ?? {};
          const trimmed: Record<string, unknown> = {};
          if (meta.display_name || meta.full_name) {
            trimmed.display_name = meta.display_name ?? meta.full_name;
          }
          if (meta.avatar_url && String(meta.avatar_url).length < 500) {
            trimmed.avatar_url = meta.avatar_url;
          }

          // Only trim if there are extra keys worth removing
          if (Object.keys(meta).length > Object.keys(trimmed).length + 2) {
            const admin = getSupabaseAdmin();
            await admin.auth.admin.updateUserById(user.id, {
              user_metadata: trimmed,
            });
          }
        } catch (trimErr) {
          // Non-fatal - the user can still sign in, just with a larger JWT
          console.warn('[auth/callback] Failed to trim user_metadata:', trimErr);
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
