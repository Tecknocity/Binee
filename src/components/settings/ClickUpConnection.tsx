"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

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
    try {
      const res = await fetch("/api/clickup/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch ClickUp status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    // Redirect to ClickUp OAuth — the server generates the URL
    // with the correct workspace ID from the user's session
    window.location.href = "/api/clickup/auth";
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
        // Poll for completion
        const pollInterval = setInterval(async () => {
          await fetchStatus();
        }, 3000);

        // Stop polling after 5 minutes
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
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-48 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-purple-400"
              fill="currentColor"
            >
              <path d="M4.105 18.015l3.612-2.756a4.161 4.161 0 0 0 4.283 0l3.612 2.756a8.305 8.305 0 0 1-11.507 0zM12 13.218a2.775 2.775 0 0 1-2.775-2.775L12 6.885l2.775 3.558A2.775 2.775 0 0 1 12 13.218z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">ClickUp</h3>
            <p className="text-xs text-zinc-500">
              Project management integration
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            status.connected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-zinc-800 text-zinc-400"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status.connected ? "bg-emerald-400" : "bg-zinc-500"
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
            <div className="rounded-md bg-zinc-800/50 px-3 py-2">
              <p className="text-xs text-zinc-500">Team</p>
              <p className="text-sm font-medium text-zinc-200">
                {status.teamName ?? "Unknown"}
              </p>
            </div>
            <div className="rounded-md bg-zinc-800/50 px-3 py-2">
              <p className="text-xs text-zinc-500">Last synced</p>
              <p className="text-sm font-medium text-zinc-200">
                {status.lastSyncedAt
                  ? formatRelativeTime(status.lastSyncedAt)
                  : "Never"}
              </p>
            </div>
          </div>

          {/* Sync status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-zinc-800/50 px-3 py-2">
              <p className="text-xs text-zinc-500">Sync status</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  status.syncStatus === "synced" && "text-emerald-400",
                  status.syncStatus === "syncing" && "text-yellow-400",
                  status.syncStatus === "error" && "text-red-400",
                  status.syncStatus === "idle" && "text-zinc-400"
                )}
              >
                {status.syncStatus === "syncing" && "Syncing..."}
                {status.syncStatus === "synced" && "Up to date"}
                {status.syncStatus === "error" && "Error"}
                {status.syncStatus === "idle" && "Idle"}
              </p>
            </div>
            <div className="rounded-md bg-zinc-800/50 px-3 py-2">
              <p className="text-xs text-zinc-500">Webhook</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  status.webhookHealthy === true && "text-emerald-400",
                  status.webhookHealthy === false && "text-red-400",
                  status.webhookHealthy === null && "text-zinc-400"
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
              <div className="rounded-md bg-zinc-800/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">API rate limit</p>
                  <p className="text-xs text-zinc-400">
                    {status.rateLimitRemaining} / {status.rateLimitTotal}{" "}
                    remaining
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-700">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      status.rateLimitRemaining / status.rateLimitTotal > 0.5
                        ? "bg-emerald-500"
                        : status.rateLimitRemaining / status.rateLimitTotal >
                            0.2
                          ? "bg-yellow-500"
                          : "bg-red-500"
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
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {status.syncError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleResync}
              disabled={syncing || status.syncStatus === "syncing"}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                "bg-purple-600 text-white hover:bg-purple-500",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {syncing || status.syncStatus === "syncing"
                ? "Syncing..."
                : "Re-sync data"}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                "border border-zinc-700 text-zinc-300 hover:border-red-700 hover:text-red-400",
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
          <p className="mb-4 text-sm text-zinc-400">
            Connect your ClickUp workspace to sync tasks, projects, and time
            tracking data. Binee will analyze your workflow and provide
            AI-powered insights.
          </p>
          <button
            onClick={handleConnect}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              "bg-purple-600 text-white hover:bg-purple-500"
            )}
          >
            Connect ClickUp
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
