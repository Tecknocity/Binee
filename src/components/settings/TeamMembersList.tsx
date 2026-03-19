'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import { Trash2, Shield, ShieldCheck, User, Loader2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceMember } from '@/types/database';

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  member: User,
};

const roleColors = {
  owner: 'text-accent',
  admin: 'text-blue-400',
  member: 'text-text-secondary',
};

const roleBgColors = {
  owner: 'bg-accent/10',
  admin: 'bg-blue-400/10',
  member: 'bg-surface-hover',
};

interface TeamMembersListProps {
  onInviteClick: () => void;
}

export default function TeamMembersList({ onInviteClick }: TeamMembersListProps) {
  const { workspace, membership, user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const supabaseRef = useRef(createBrowserClient());
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  const workspaceId = workspace?.id;

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    const loadMembers = async () => {
      setLoading(true);
      try {
        const { data } = await supabaseRef.current
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: true });

        if (!cancelled) {
          setMembers((data as WorkspaceMember[]) ?? []);
        }
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMembers();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleRemove = async (member: WorkspaceMember) => {
    if (member.role === 'owner') return;
    if (!confirm(`Remove ${member.display_name || member.email} from this workspace?`)) return;

    setRemoving(member.id);
    try {
      await supabaseRef.current
        .from('workspace_members')
        .update({ status: 'removed' })
        .eq('id', member.id);

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 animate-pulse rounded bg-navy-light" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full animate-pulse bg-navy-light" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 animate-pulse rounded bg-navy-light" />
                <div className="h-3 w-40 animate-pulse rounded bg-navy-light" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-text-primary">
          Team Members
          <span className="text-text-muted text-sm font-normal ml-2">({members.length})</span>
        </h2>
        {isAdmin && (
          <button
            onClick={onInviteClick}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            Invite
          </button>
        )}
      </div>

      <div className="space-y-1">
        {members.map((member) => {
          const RoleIcon = roleIcons[member.role];
          const initials = (member.display_name || member.email)
            .split(/[\s@]/)
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          const isCurrentUser = member.user_id === user?.id;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-navy-base/50 transition-colors"
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.display_name || ''}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-accent text-xs font-bold">{initials}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {member.display_name || member.email}
                  {isCurrentUser && (
                    <span className="text-text-muted text-xs font-normal ml-1.5">(you)</span>
                  )}
                </p>
                <p className="text-xs text-text-muted truncate">{member.email}</p>
              </div>

              {member.status === 'pending' && (
                <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  Pending
                </span>
              )}

              <div
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
                  roleColors[member.role],
                  roleBgColors[member.role]
                )}
              >
                <RoleIcon className="w-3.5 h-3.5" />
                <span className="capitalize">{member.role}</span>
              </div>

              {isAdmin && member.role !== 'owner' && !isCurrentUser && (
                <button
                  onClick={() => handleRemove(member)}
                  disabled={removing === member.id}
                  className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors disabled:opacity-50"
                  title="Remove member"
                >
                  {removing === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <p className="text-sm text-text-muted text-center py-6">
            No team members yet. Invite someone to get started.
          </p>
        )}
      </div>
    </div>
  );
}
