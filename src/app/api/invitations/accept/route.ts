import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const body = await request.json();
  const { token, user_id } = body;

  if (!token || !user_id) {
    return NextResponse.json({ error: 'token and user_id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find the invitation
  const { data: invitation, error: invError } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (invError || !invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from('workspace_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invitation.workspace_id)
    .eq('user_id', user_id)
    .single();

  if (existingMember) {
    // Mark invitation as accepted anyway
    await supabase
      .from('workspace_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);
    return NextResponse.json({ success: true, already_member: true, workspace_id: invitation.workspace_id });
  }

  // Get user profile info
  const { data: { user } } = await supabase.auth.admin.getUserById(user_id);

  // Add user as workspace member
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: invitation.workspace_id,
    user_id,
    role: invitation.role,
    email: invitation.email,
    display_name: user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'User',
    avatar_url: user?.user_metadata?.avatar_url ?? null,
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Mark invitation as accepted
  await supabase
    .from('workspace_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id);

  return NextResponse.json({ success: true, workspace_id: invitation.workspace_id });
}
