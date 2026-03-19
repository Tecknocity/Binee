import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { inviteMember } from '@/lib/workspace/invitations';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();

  // Authenticate the requesting user via their session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only in route handlers for this use-case
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, email, role } = body;

  if (!workspace_id || !email) {
    return NextResponse.json({ error: 'workspace_id and email are required' }, { status: 400 });
  }

  const result = await inviteMember(
    workspace_id,
    email,
    user.id,
    role ?? 'member',
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
