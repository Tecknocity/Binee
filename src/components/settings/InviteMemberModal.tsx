'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import { X, Send, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InviteMemberModal({ open, onClose }: InviteMemberModalProps) {
  const { workspace, user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !workspace || !user) return;

    setError(null);
    setSending(true);

    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        setError('This person is already a member of this workspace.');
        setSending(false);
        return;
      }

      // Check for existing pending invitation
      const { data: existingInvite } = await supabase
        .from('workspace_invitations')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        setError('An invitation is already pending for this email.');
        setSending(false);
        return;
      }

      // Create invitation
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: insertError } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspace.id,
          email,
          role,
          invited_by: user.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        setError('Failed to send invitation. Please try again.');
        setSending(false);
        return;
      }

      setSent(true);
      setEmail('');
      setTimeout(() => {
        setSent(false);
        onClose();
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setEmail('');
    setRole('member');
    setError(null);
    setSent(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Invite Team Member</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-12 h-12 text-success" />
              <p className="text-text-primary font-medium">Invitation sent!</p>
              <p className="text-sm text-text-secondary text-center">
                An invitation has been sent to the provided email address.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                  className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                >
                  <option value="member">Member — can view and use AI features</option>
                  <option value="admin">Admin — can manage workspace settings</option>
                </select>
              </div>

              {error && (
                <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending || !email}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'bg-accent hover:bg-accent-hover text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
