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

          // Always trim if there are ANY extra keys beyond what we keep.
          // Even a few extra keys (iss, sub, email_verified, etc.) add up
          // in the JWT and contribute to cookie bloat over time.
          const extraKeys = Object.keys(meta).filter(
            (k) => !(k in trimmed),
          );
          if (extraKeys.length > 0) {
            const admin = getSupabaseAdmin();
            await admin.auth.admin.updateUserById(user.id, {
              user_metadata: trimmed,
            });

            // CRITICAL: Refresh the session so the response cookies use
            // the trimmed metadata. Without this, exchangeCodeForSession()
            // already wrote fat JWT cookies to the response. refreshSession()
            // generates a NEW smaller JWT that overwrites the fat cookies
            // via the setAll callback.
            await supabase.auth.refreshSession();
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
