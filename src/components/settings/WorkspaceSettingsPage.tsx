'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/hooks/usePermissions';
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
  History,
  RotateCcw,
  FolderOpen,
  Folder,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import TeamMembersList from '@/components/settings/TeamMembersList';
import InviteMemberModal from '@/components/settings/InviteMemberModal';


const planBadges: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-surface-hover text-text-secondary' },
  starter: { label: 'Starter', color: 'bg-blue-500/10 text-blue-400' },
  pro: { label: 'Pro', color: 'bg-accent/10 text-accent' },
};

export default function WorkspaceSettingsPage() {
  const { workspace, membership, refreshWorkspace, loading } = useAuth();
  const { isOwner, canEditWorkspace } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const supabaseRef = useRef(createBrowserClient());
  const supabase = supabaseRef.current;
  const plan = planBadges[workspace?.plan ?? 'free'] ?? planBadges.free;

  // Sync name state when workspace loads or changes
  useEffect(() => {
    if (workspace?.name) {
      setName(workspace.name);
    }
  }, [workspace?.name]);

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

  if (loading || !workspace) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg animate-pulse bg-navy-light" />
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-navy-light" />
                <div className="h-3 w-48 animate-pulse rounded bg-navy-light" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-10 w-full animate-pulse rounded-lg bg-navy-light" />
              <div className="h-10 w-2/3 animate-pulse rounded-lg bg-navy-light" />
            </div>
          </div>
        ))}
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
                {canEditWorkspace && (
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

      {/* Workspace Snapshots */}
      {isOwner && <WorkspaceSnapshots workspaceId={workspace.id} />}

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

// ---------------------------------------------------------------------------
// Workspace Snapshots
// ---------------------------------------------------------------------------

interface Snapshot {
  id: string;
  snapshot_type: string;
  created_at: string;
  summary: { spaces: number; folders: number; lists: number };
}

function WorkspaceSnapshots({ workspaceId }: { workspaceId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<{ success: boolean; summary: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/setup/snapshot-restore?workspace_id=${encodeURIComponent(workspaceId)}`);
        if (res.ok) {
          const data = await res.json();
          setSnapshots(data.snapshots || []);
        }
      } catch (err) {
        console.error('Failed to fetch snapshots:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  const handleRestore = async (snapshot: Snapshot) => {
    setRestoring(snapshot.id);
    setResult(null);
    try {
      const res = await fetch('/api/setup/snapshot-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, snapshot_id: snapshot.id }),
      });
      const data = await res.json();
      setResult({ success: data.success, summary: data.summary || 'Restore complete' });
    } catch (err) {
      setResult({ success: false, summary: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setRestoring(null);
      setConfirmRestore(null);
    }
  };

  const typeLabels: Record<string, string> = {
    initial_connect: 'Initial Connect',
    pre_build: 'Pre-Build',
    manual: 'Manual',
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg animate-pulse bg-navy-light" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-navy-light" />
            <div className="h-3 w-56 animate-pulse rounded bg-navy-light" />
          </div>
        </div>
      </div>
    );
  }

  if (snapshots.length === 0) return null;

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <History className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-text-primary">Workspace Snapshots</h2>
              <p className="text-sm text-text-secondary">
                Restore your ClickUp workspace to a previous state
              </p>
            </div>
          </div>
        </div>

        {result && (
          <div className={cn(
            'mb-4 p-3 rounded-lg text-sm',
            result.success ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'
          )}>
            {result.summary}
          </div>
        )}

        <div className="space-y-3">
          {snapshots.map((snap) => (
            <div key={snap.id} className="flex items-center justify-between p-3 rounded-lg bg-navy-base/50 border border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2 text-xs text-text-muted shrink-0">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-medium',
                    snap.snapshot_type === 'pre_build' ? 'bg-accent/10 text-accent' : 'bg-surface-hover text-text-secondary'
                  )}>
                    {typeLabels[snap.snapshot_type] || snap.snapshot_type}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    {formatDate(snap.created_at)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" /> {snap.summary.spaces} spaces
                    </span>
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" /> {snap.summary.folders} folders
                    </span>
                    <span className="flex items-center gap-1">
                      <List className="w-3 h-3" /> {snap.summary.lists} lists
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setConfirmRestore(snap)}
                disabled={!!restoring}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-warning border border-warning/30 rounded-lg hover:bg-warning/10 transition-colors disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Restore workspace?
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  This will delete all ClickUp spaces, folders, and lists that were created
                  after this snapshot was taken. Items that existed before will be kept.
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                  <span>Snapshot: {typeLabels[confirmRestore.snapshot_type] || confirmRestore.snapshot_type}</span>
                  <span>{formatDate(confirmRestore.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmRestore(null)}
                disabled={!!restoring}
                className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmRestore)}
                disabled={!!restoring}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-warning rounded-lg hover:bg-warning/90 transition-colors disabled:opacity-50"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Yes, restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
