import { NextResponse } from 'next/server';
import { acceptInvitation } from '@/lib/workspace/invitations';

export async function POST(request: Request) {
  const body = await request.json();
  const { user_id, email } = body;

  if (!user_id || !email) {
    return NextResponse.json({ error: 'user_id and email required' }, { status: 400 });
  }

  const result = await acceptInvitation(user_id, email);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
