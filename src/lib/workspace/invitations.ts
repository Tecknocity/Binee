import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceInvitation, WorkspaceMember } from '@/types/database';
import { randomBytes } from 'crypto';

// Result types
export interface InviteResult {
  success: boolean;
  invitation?: WorkspaceInvitation;
  error?: string;
}

interface AcceptResult {
  success: boolean;
  workspace_id?: string;
  already_member?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal: get a service-role Supabase client for admin operations
// ---------------------------------------------------------------------------
function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// Verify the requesting user is an admin (or owner) of the workspace
// ---------------------------------------------------------------------------
async function verifyAdmin(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  return data?.role === 'owner' || data?.role === 'admin';
}

// ---------------------------------------------------------------------------
// inviteMember
// Admin invites a user by email. Creates a workspace_invitations row with
// status='pending' and a secure token. Also creates a workspace_members row
// with status='pending' and invited_email for visibility in the members list.
// ---------------------------------------------------------------------------
export async function inviteMember(
  workspaceId: string,
  email: string,
  invitedBy: string,
  role: 'admin' | 'member' = 'member',
): Promise<InviteResult> {
  const supabase = getServiceClient();

  // 1. Verify the inviter is an admin/owner
  const isAdmin = await verifyAdmin(supabase, workspaceId, invitedBy);
  if (!isAdmin) {
    return { success: false, error: 'Only workspace admins can invite members' };
  }

  // 2. Normalise email
  const normalisedEmail = email.trim().toLowerCase();

  // 3. Check if there's already an active member with this email
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('email', normalisedEmail)
    .in('status', ['active'])
    .maybeSingle();

  if (existingMember) {
    return { success: false, error: 'This user is already a member of the workspace' };
  }

  // 4. Check for an existing pending invitation (avoid duplicates)
  const { data: existingInvite } = await supabase
    .from('workspace_invitations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', normalisedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: 'An invitation is already pending for this email' };
  }

  // 5. Generate a secure token
  const token = randomBytes(32).toString('hex');

  // 6. Create the workspace_invitations row
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  const { data: invitation, error: invError } = await supabase
    .from('workspace_invitations')
    .insert({
      workspace_id: workspaceId,
      email: normalisedEmail,
      role,
      invited_by: invitedBy,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (invError) {
    return { success: false, error: invError.message };
  }

  // 7. Also create a workspace_members row with status='pending' for visibility
  await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: invitedBy, // placeholder — will be replaced on acceptance
    role,
    email: normalisedEmail,
    invited_email: normalisedEmail,
    status: 'pending',
    display_name: null,
    avatar_url: null,
  });

  return { success: true, invitation: invitation as WorkspaceInvitation };
}

// ---------------------------------------------------------------------------
// acceptInvitation
// Called after a user signs up or logs in. Finds any pending invitations
// matching their email and activates them.
// ---------------------------------------------------------------------------
export async function acceptInvitation(
  userId: string,
  email: string,
): Promise<AcceptResult> {
  const supabase = getServiceClient();
  const normalisedEmail = email.trim().toLowerCase();

  // 1. Find pending invitations for this email
  const { data: invitations, error: fetchError } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('email', normalisedEmail)
    .eq('status', 'pending');

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!invitations || invitations.length === 0) {
    return { success: true }; // No pending invitations — nothing to do
  }

  // Get user profile for display info
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const displayName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    normalisedEmail.split('@')[0] ??
    'User';
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;

  let lastWorkspaceId: string | undefined;

  for (const invitation of invitations) {
    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      continue;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id, status')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // Already an active member — just mark invitation accepted
      await supabase
        .from('workspace_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);
      continue;
    }

    // Update the pending workspace_members row (created during invite) to active
    const { data: pendingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('invited_email', normalisedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingMember) {
      await supabase
        .from('workspace_members')
        .update({
          user_id: userId,
          status: 'active',
          joined_at: new Date().toISOString(),
          display_name: displayName,
          avatar_url: avatarUrl,
        })
        .eq('id', pendingMember.id);
    } else {
      // No pending member row — create a fresh one
      await supabase.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        role: invitation.role,
        email: normalisedEmail,
        display_name: displayName,
        avatar_url: avatarUrl,
        invited_email: normalisedEmail,
        status: 'active',
        joined_at: new Date().toISOString(),
      });
    }

    // Mark invitation as accepted
    await supabase
      .from('workspace_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    lastWorkspaceId = invitation.workspace_id;
  }

  return { success: true, workspace_id: lastWorkspaceId };
}

// ---------------------------------------------------------------------------
// removeMember
// Admin removes a workspace member. Cannot remove the workspace owner.
// ---------------------------------------------------------------------------
export async function removeMember(
  workspaceId: string,
  memberId: string,
  requestingUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  // 1. Verify the requester is admin/owner
  const isAdmin = await verifyAdmin(supabase, workspaceId, requestingUserId);
  if (!isAdmin) {
    return { success: false, error: 'Only workspace admins can remove members' };
  }

  // 2. Fetch the member to be removed
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, status, invited_email')
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
    .single();

  if (memberError || !member) {
    return { success: false, error: 'Member not found' };
  }

  // 3. Prevent removing the workspace owner
  if (member.role === 'owner') {
    return { success: false, error: 'Cannot remove the workspace owner' };
  }

  // 4. Delete the workspace_members row
  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // 5. If the member was pending, also expire the corresponding invitation
  if (member.status === 'pending' && member.invited_email) {
    await supabase
      .from('workspace_invitations')
      .update({ status: 'expired' })
      .eq('workspace_id', workspaceId)
      .eq('email', member.invited_email)
      .eq('status', 'pending');
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// getPendingInvitations
// Returns all pending workspace members (status='pending') for the workspace.
// ---------------------------------------------------------------------------
export async function getPendingInvitations(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as WorkspaceMember[];
}
