'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  Building2,
  Pencil,
  Check,
  X,
  Loader2,
  Trash2,
  AlertTriangle,
  Calendar,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import TeamMembersList from '@/components/settings/TeamMembersList';
import InviteMemberModal from '@/components/settings/InviteMemberModal';
import ConnectionStatus from '@/components/settings/ConnectionStatus';

const planBadges: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-surface-hover text-text-secondary' },
  starter: { label: 'Starter', color: 'bg-blue-500/10 text-blue-400' },
  pro: { label: 'Pro', color: 'bg-accent/10 text-accent' },
};

export default function WorkspaceSettingsPage() {
  const { workspace, membership, refreshWorkspace } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const supabase = createBrowserClient();
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const isOwner = membership?.role === 'owner';
  const plan = planBadges[workspace?.plan ?? 'free'] ?? planBadges.free;

  const handleSaveName = async () => {
    if (!workspace || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ name: name.trim() })
        .eq('id', workspace.id);

      if (!error) {
        await refreshWorkspace();
        setEditing(false);
      }
    } catch (err) {
      console.error('Failed to rename workspace:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setName(workspace?.name ?? '');
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!workspace || deleteConfirmText !== workspace.name) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspace.id);

      if (!error) {
        window.location.href = '/chat';
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (!workspace) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Workspace Info */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-text-primary">Workspace</h2>
              <p className="text-sm text-text-secondary">General workspace information</p>
            </div>
          </div>
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', plan.color)}>
            {plan.label}
          </span>
        </div>

        <div className="space-y-4 mt-5">
          {/* Workspace name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Workspace name
            </label>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 bg-navy-base border border-accent rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving || !name.trim()}
                  className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-text-primary font-medium">{workspace.name}</p>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setName(workspace.name);
                      setEditing(true);
                    }}
                    className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                    title="Rename workspace"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Created date and owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-navy-base/50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-text-muted mb-0.5">
                <Calendar className="w-3.5 h-3.5" />
                Created
              </div>
              <p className="text-sm font-medium text-text-primary">
                {formatDate(workspace.created_at)}
              </p>
            </div>
            <div className="rounded-lg bg-navy-base/50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-text-muted mb-0.5">
                <Crown className="w-3.5 h-3.5" />
                Your role
              </div>
              <p className="text-sm font-medium text-text-primary capitalize">
                {membership?.role ?? 'Member'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <TeamMembersList onInviteClick={() => setShowInviteModal(true)} />

      {/* ClickUp Connection */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <ConnectionStatus />
      </div>

      {/* Danger Zone — owner only */}
      {isOwner && (
        <div className="border border-error/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-error" />
            <h2 className="text-lg font-medium text-error">Danger Zone</h2>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Deleting a workspace is permanent and cannot be undone. All data, members,
            and integrations will be removed.
          </p>

          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Type <span className="text-text-primary font-mono font-medium">{workspace.name}</span> to
                confirm deletion.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={workspace.name}
                className="w-full px-3 py-2 bg-navy-base border border-error/30 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-error focus:ring-1 focus:ring-error/50 transition-colors"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== workspace.name}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-error hover:bg-red-600 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Deleting...' : 'Delete Workspace'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-error/30 text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete this workspace
            </button>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}
