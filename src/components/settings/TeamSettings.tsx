'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserPlus, Trash2, Shield, ShieldCheck, User, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MockMember {
  id: string;
  display_name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  avatar_url: string | null;
  joined: string;
}

const mockMembers: MockMember[] = [
  {
    id: '1',
    display_name: 'Alex Chen',
    email: 'alex@acmecorp.com',
    role: 'owner',
    avatar_url: null,
    joined: '2025-12-01',
  },
  {
    id: '2',
    display_name: 'Sarah Kim',
    email: 'sarah@acmecorp.com',
    role: 'admin',
    avatar_url: null,
    joined: '2026-01-10',
  },
  {
    id: '3',
    display_name: 'Marcus Johnson',
    email: 'marcus@acmecorp.com',
    role: 'member',
    avatar_url: null,
    joined: '2026-02-15',
  },
];

const roleIcons = {
  owner: ShieldCheck,
  admin: Shield,
  member: User,
};

const roleColors = {
  owner: 'text-accent',
  admin: 'text-info',
  member: 'text-text-secondary',
};

export default function TeamSettings() {
  const { membership } = useAuth();
  const [members] = useState<MockMember[]>(mockMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    // Placeholder: would create workspace invitation
    await new Promise((r) => setTimeout(r, 600));
    setInviting(false);
    setInviteSent(true);
    setInviteEmail('');
    setTimeout(() => setInviteSent(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Invite form */}
      {isAdmin && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-medium text-text-primary mb-1">Invite Team Members</h2>
          <p className="text-sm text-text-secondary mb-4">
            Send an invitation to join this workspace
          </p>

          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="flex-1 px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Invite
            </button>
          </form>

          {inviteSent && (
            <p className="text-sm text-success mt-3">Invitation sent successfully!</p>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-text-primary">
            Team Members
            <span className="text-text-muted text-sm font-normal ml-2">({members.length})</span>
          </h2>
        </div>

        <div className="space-y-2">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role];
            const initials = member.display_name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-navy-base/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-accent text-xs font-bold">{initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {member.display_name}
                  </p>
                  <p className="text-xs text-text-muted truncate">{member.email}</p>
                </div>

                <div className={cn('flex items-center gap-1.5 text-xs font-medium', roleColors[member.role])}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  <span className="capitalize">{member.role}</span>
                </div>

                {isAdmin && member.role !== 'owner' && (
                  <button
                    className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
