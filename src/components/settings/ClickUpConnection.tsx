"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

interface ConnectionStatus {
  connected: boolean;
  teamName: string | null;
  lastSyncedAt: string | null;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string | null;
  rateLimitRemaining: number | null;
  rateLimitTotal: number | null;
  webhookHealthy: boolean | null;
}

/**
 * ClickUp Connection Settings Component
 *
 * Displays the current ClickUp integration status and provides controls
 * for connecting, disconnecting, and manually re-syncing data.
 */
export function ClickUpConnection() {
  const { workspace_id } = useWorkspace();
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    teamName: null,
    lastSyncedAt: null,
    syncStatus: "idle",
    syncError: null,
    rateLimitRemaining: null,
    rateLimitTotal: null,
    webhookHealthy: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!workspace_id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/clickup/status?workspace_id=${encodeURIComponent(workspace_id)}`);
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          lastSyncedAt: data.last_synced_at ?? null,
          syncStatus: data.sync_status ?? "idle",
          syncError: data.sync_error ?? null,
          rateLimitRemaining: null,
          rateLimitTotal: null,
          webhookHealthy: data.webhook_healthy ?? null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch ClickUp status:", err);
    } finally {
      setLoading(false);
    }
  }, [workspace_id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    if (!workspace_id) return;
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect ClickUp? This will remove all cached data.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch("/api/clickup/disconnect", { method: "POST" });
      if (res.ok) {
        setStatus((prev) => ({
          ...prev,
          connected: false,
          teamName: null,
          lastSyncedAt: null,
          syncStatus: "idle",
          syncError: null,
          rateLimitRemaining: null,
          rateLimitTotal: null,
          webhookHealthy: null,
        }));
      }
    } catch (err) {
      console.error("Failed to disconnect ClickUp:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleResync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/clickup/sync", { method: "POST" });
      if (res.ok) {
        setStatus((prev) => ({ ...prev, syncStatus: "syncing" }));
        const pollInterval = setInterval(async () => {
          await fetchStatus();
        }, 3000);
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error("Failed to trigger re-sync:", err);
    } finally {
      setSyncing(false);
    }
  };

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
      </div>
    );
  }

  return (
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
            <h3 className="text-sm font-semibold text-text-primary">ClickUp</h3>
            <p className="text-xs text-text-muted">
              Project management integration
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            status.connected
              ? "bg-success/10 text-success"
              : "bg-surface-hover text-text-muted"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status.connected ? "bg-success" : "bg-text-muted"
            )}
          />
          {status.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Connected state */}
      {status.connected && (
        <div className="mt-5 space-y-4">
          {/* Team info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-navy-base/50 px-3 py-2">
              <p className="text-xs text-text-muted">Team</p>
              <p className="text-sm font-medium text-text-primary">
                {status.teamName ?? "Unknown"}
              </p>
            </div>
            <div className="rounded-lg bg-navy-base/50 px-3 py-2">
              <p className="text-xs text-text-muted">Last synced</p>
              <p className="text-sm font-medium text-text-primary">
                {status.lastSyncedAt
                  ? formatRelativeTime(status.lastSyncedAt)
                  : "Never"}
              </p>
            </div>
          </div>

          {/* Sync status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-navy-base/50 px-3 py-2">
              <p className="text-xs text-text-muted">Sync status</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  status.syncStatus === "synced" && "text-success",
                  status.syncStatus === "syncing" && "text-warning",
                  status.syncStatus === "error" && "text-error",
                  status.syncStatus === "idle" && "text-text-secondary"
                )}
              >
                {status.syncStatus === "syncing" && "Syncing..."}
                {status.syncStatus === "synced" && "Up to date"}
                {status.syncStatus === "error" && "Error"}
                {status.syncStatus === "idle" && "Idle"}
              </p>
            </div>
            <div className="rounded-lg bg-navy-base/50 px-3 py-2">
              <p className="text-xs text-text-muted">Webhook</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  status.webhookHealthy === true && "text-success",
                  status.webhookHealthy === false && "text-error",
                  status.webhookHealthy === null && "text-text-secondary"
                )}
              >
                {status.webhookHealthy === true && "Healthy"}
                {status.webhookHealthy === false && "Unhealthy"}
                {status.webhookHealthy === null && "Unknown"}
              </p>
            </div>
          </div>

          {/* Rate limit */}
          {status.rateLimitRemaining !== null &&
            status.rateLimitTotal !== null && (
              <div className="rounded-lg bg-navy-base/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-muted">API rate limit</p>
                  <p className="text-xs text-text-secondary">
                    {status.rateLimitRemaining} / {status.rateLimitTotal}{" "}
                    remaining
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-navy-dark">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      status.rateLimitRemaining / status.rateLimitTotal > 0.5
                        ? "bg-success"
                        : status.rateLimitRemaining / status.rateLimitTotal >
                            0.2
                          ? "bg-warning"
                          : "bg-error"
                    )}
                    style={{
                      width: `${(status.rateLimitRemaining / status.rateLimitTotal) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

          {/* Error message */}
          {status.syncError && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
              {status.syncError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleResync}
              disabled={syncing || status.syncStatus === "syncing"}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-[#7B68EE] text-white hover:bg-[#6A5ACD]",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {syncing || status.syncStatus === "syncing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing || status.syncStatus === "syncing"
                ? "Syncing..."
                : "Re-sync data"}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "border border-border text-text-secondary hover:border-error/30 hover:text-error hover:bg-error/5",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
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
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors bg-[#7B68EE] text-white hover:bg-[#6A5ACD]"
          >
            <Plug className="w-4 h-4" />
            Connect ClickUp
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
