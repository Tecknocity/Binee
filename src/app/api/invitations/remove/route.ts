import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { removeMember } from '@/lib/workspace/invitations';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only
        },
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { workspace_id, member_id } = body;

  if (!workspace_id || !member_id) {
    return NextResponse.json({ error: 'workspace_id and member_id are required' }, { status: 400 });
  }

  const result = await removeMember(workspace_id, member_id, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
