'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plug,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionStatus {
  connected: boolean;
  teamName: string | null;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'complete' | 'error';
  syncError: string | null;
  planTier: string | null;
  rateLimitRemaining: number | null;
  rateLimitTotal: number | null;
  webhookHealthy: boolean | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  unlimited: 'Unlimited',
  business: 'Business',
  business_plus: 'Business Plus',
  enterprise: 'Enterprise',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ClickUp Connection Card (B-024)
 *
 * Displays ClickUp connection status, plan tier, sync status, rate limit
 * indicator, and provides connect/disconnect/re-sync controls.
 */
export function ClickUpConnectionCard() {
  const { workspace_id, membership } = useWorkspace();
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    teamName: null,
    lastSyncedAt: null,
    syncStatus: 'idle',
    syncError: null,
    planTier: null,
    rateLimitRemaining: null,
    rateLimitTotal: null,
    webhookHealthy: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch status
  // -----------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    if (!workspace_id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/clickup/status?workspace_id=${encodeURIComponent(workspace_id)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          lastSyncedAt: data.last_synced_at ?? null,
          syncStatus: data.sync_status ?? 'idle',
          syncError: data.sync_error ?? null,
          planTier: data.plan_tier ?? null,
          rateLimitRemaining: data.rate_limit_remaining ?? null,
          rateLimitTotal: data.rate_limit_total ?? null,
          webhookHealthy: data.webhook_healthy ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch ClickUp status:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace_id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleConnect = () => {
    if (!workspace_id) return;
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}`;
  };

  const handleDisconnect = async () => {
    if (!workspace_id) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/clickup/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
      if (res.ok) {
        setStatus({
          connected: false,
          teamName: null,
          lastSyncedAt: null,
          syncStatus: 'idle',
          syncError: null,
          planTier: null,
          rateLimitRemaining: null,
          rateLimitTotal: null,
          webhookHealthy: null,
        });
        setShowDisconnectModal(false);
      }
    } catch (err) {
      console.error('Failed to disconnect ClickUp:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleResync = async () => {
    if (!workspace_id) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/clickup/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
      if (res.ok) {
        setStatus((prev) => ({ ...prev, syncStatus: 'syncing' }));
        // Poll for sync completion
        const pollInterval = setInterval(async () => {
          await fetchStatus();
        }, 3000);
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Failed to trigger re-sync:', err);
    } finally {
      setSyncing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const isThrottled =
    status.rateLimitRemaining !== null &&
    status.rateLimitTotal !== null &&
    status.rateLimitRemaining / status.rateLimitTotal < 0.2;

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-navy-light" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-navy-light" />
            <div className="h-3 w-48 animate-pulse rounded bg-navy-light" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-navy-light" />
          ))}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7B68EE]/15">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[#7B68EE]"
                fill="none"
              >
                <path
                  d="M4.5 17.5L8.5 14L12 17L15.5 14L19.5 17.5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 11.5L12 5L19.5 11.5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                ClickUp
              </h3>
              <p className="text-xs text-text-muted">
                Project management integration
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              status.connected
                ? 'bg-success/10 text-success'
                : 'bg-surface-hover text-text-muted',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status.connected ? 'bg-success' : 'bg-text-muted',
              )}
            />
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Connected state */}
        {status.connected && (
          <div className="mt-5 space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <p className="text-xs text-text-muted">Team</p>
                <p className="text-sm font-medium text-text-primary">
                  {status.teamName ?? 'Unknown'}
                </p>
              </div>
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <p className="text-xs text-text-muted">Last synced</p>
                <p className="text-sm font-medium text-text-primary">
                  {status.lastSyncedAt
                    ? formatRelativeTime(status.lastSyncedAt)
                    : 'Never'}
                </p>
              </div>
            </div>

            {/* Plan tier & sync status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <p className="text-xs text-text-muted">Plan tier</p>
                <p className="text-sm font-medium text-text-primary">
                  {status.planTier
                    ? PLAN_LABELS[status.planTier] ?? status.planTier
                    : 'Unknown'}
                </p>
              </div>
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <p className="text-xs text-text-muted">Sync status</p>
                <p
                  className={cn(
                    'text-sm font-medium',
                    status.syncStatus === 'complete' && 'text-success',
                    status.syncStatus === 'syncing' && 'text-warning',
                    status.syncStatus === 'error' && 'text-error',
                    status.syncStatus === 'idle' && 'text-text-secondary',
                  )}
                >
                  {status.syncStatus === 'syncing' && 'Syncing...'}
                  {status.syncStatus === 'complete' && 'Up to date'}
                  {status.syncStatus === 'error' && 'Error'}
                  {status.syncStatus === 'idle' && 'Idle'}
                </p>
              </div>
            </div>

            {/* Webhook health */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <p className="text-xs text-text-muted">Webhook</p>
                <p
                  className={cn(
                    'text-sm font-medium',
                    status.webhookHealthy === true && 'text-success',
                    status.webhookHealthy === false && 'text-error',
                    status.webhookHealthy === null && 'text-text-secondary',
                  )}
                >
                  {status.webhookHealthy === true && 'Healthy'}
                  {status.webhookHealthy === false && 'Unhealthy'}
                  {status.webhookHealthy === null && 'Unknown'}
                </p>
              </div>

              {/* Rate limit indicator */}
              {status.rateLimitRemaining !== null &&
                status.rateLimitTotal !== null && (
                  <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-muted">API rate limit</p>
                      {isThrottled && (
                        <Zap className="h-3 w-3 text-warning" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-navy-dark">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            status.rateLimitRemaining / status.rateLimitTotal >
                              0.5
                              ? 'bg-success'
                              : status.rateLimitRemaining /
                                    status.rateLimitTotal >
                                  0.2
                                ? 'bg-warning'
                                : 'bg-error',
                          )}
                          style={{
                            width: `${(status.rateLimitRemaining / status.rateLimitTotal) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-text-secondary">
                        {status.rateLimitRemaining}/{status.rateLimitTotal}
                      </span>
                    </div>
                  </div>
                )}
            </div>

            {/* Throttled warning */}
            {isThrottled && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-sm text-warning">
                <Zap className="h-4 w-4 shrink-0" />
                Rate limited — API requests are being throttled.
              </div>
            )}

            {/* Sync error message */}
            {status.syncError && (
              <div className="rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
                {status.syncError}
              </div>
            )}

            {/* Actions */}
            {isAdmin ? (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleResync}
                  disabled={syncing || status.syncStatus === 'syncing'}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    'bg-[#7B68EE] text-white hover:bg-[#6A5ACD]',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {syncing || status.syncStatus === 'syncing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {syncing || status.syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Re-sync data'}
                </button>
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={disconnecting}
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    'border border-border text-text-secondary hover:border-error/30 hover:text-error hover:bg-error/5',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <p className="pt-1 text-xs text-text-muted">
                Only workspace owners and admins can manage this integration.
              </p>
            )}
          </div>
        )}

        {/* Disconnected state */}
        {!status.connected && (
          <div className="mt-5">
            <p className="mb-4 text-sm text-text-secondary">
              Connect your ClickUp workspace to sync tasks, projects, and time
              tracking data. Binee will analyze your workflow and provide
              AI-powered insights.
            </p>
            {isAdmin ? (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 rounded-lg bg-[#7B68EE] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6A5ACD]"
              >
                <Plug className="h-4 w-4" />
                Connect ClickUp
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </button>
            ) : (
              <p className="text-xs text-text-muted">
                Ask a workspace owner or admin to connect ClickUp.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Disconnect confirmation modal */}
      {showDisconnectModal && (
        <DisconnectModal
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectModal(false)}
          disconnecting={disconnecting}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Disconnect Confirmation Modal
// ---------------------------------------------------------------------------

function DisconnectModal({
  onConfirm,
  onCancel,
  disconnecting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disconnecting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/10">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Disconnect ClickUp
            </h3>
            <p className="text-xs text-text-muted">
              This action cannot be undone automatically
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm text-text-secondary">
          Are you sure you want to disconnect ClickUp? This will remove all
          cached data, webhooks, and sync history. You can reconnect at any
          time.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={disconnecting}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disconnecting}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'bg-error text-white hover:bg-red-600',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
