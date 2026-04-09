import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/auth/trim-metadata
 *
 * Strips excess data from the user's Supabase user_metadata to reduce JWT
 * cookie size. The Supabase JWT is stored in chunked cookies (~3180 bytes
 * each). Google OAuth and repeated updateUser() calls can bloat
 * user_metadata, pushing total cookie size past Vercel's 16KB header limit
 * (error 494 REQUEST_HEADER_TOO_LARGE).
 *
 * This endpoint keeps only the fields we actually use (display_name,
 * avatar_url) and strips everything else via the admin API.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Authenticate the caller
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // read-only for this endpoint
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
    );
  }

  // Extract only the fields we need from user_metadata
  const currentMeta = user.user_metadata ?? {};
  const trimmedMeta: Record<string, unknown> = {};

  // Keep display_name - fall back to full_name from OAuth
  if (currentMeta.display_name) {
    trimmedMeta.display_name = currentMeta.display_name;
  } else if (currentMeta.full_name) {
    trimmedMeta.display_name = currentMeta.full_name;
  }

  // Keep avatar_url (small string)
  if (currentMeta.avatar_url) {
    trimmedMeta.avatar_url = currentMeta.avatar_url;
  }

  // Use admin API to REPLACE (not merge) user_metadata
  try {
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { user_metadata: trimmedMeta },
    );

    if (updateError) {
      console.error('[trim-metadata] Admin update failed:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to trim metadata', detail: updateError.message },
        { status: 500 },
      );
    }

    const originalSize = JSON.stringify(currentMeta).length;
    const trimmedSize = JSON.stringify(trimmedMeta).length;

    return NextResponse.json({
      success: true,
      originalKeys: Object.keys(currentMeta),
      keptKeys: Object.keys(trimmedMeta),
      bytesSaved: originalSize - trimmedSize,
      message:
        'Metadata trimmed. Sign out and sign back in for changes to take effect in your JWT.',
    });
  } catch (err) {
    console.error('[trim-metadata] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
