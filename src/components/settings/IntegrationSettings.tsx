'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Plug, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';

export default function IntegrationSettings() {
  const { workspace } = useAuth();
  const isConnected = !!workspace?.clickup_team_id;
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      {/* ClickUp Integration */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          {/* ClickUp icon */}
          <div className="w-12 h-12 rounded-xl bg-[#7B68EE]/10 border border-[#7B68EE]/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 17.5L8.5 14L12 17L15.5 14L19.5 17.5"
                stroke="#7B68EE"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4.5 11.5L12 5L19.5 11.5"
                stroke="#7B68EE"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-medium text-text-primary">ClickUp</h3>
              {isConnected ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-text-muted bg-surface px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Not connected
                </span>
              )}
            </div>

            <p className="text-sm text-text-secondary mb-4">
              Connect your ClickUp workspace to enable AI-powered setup, health monitoring, and custom dashboards.
            </p>

            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-text-muted">Team ID:</span>{' '}
                    <span className="text-text-primary font-mono">{workspace.clickup_team_id}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Last sync:</span>{' '}
                    <span className="text-text-primary">2 hours ago</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-base border border-border rounded-lg text-sm text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Sync now
                  </button>

                  <button className="flex items-center gap-2 px-4 py-2 border border-error/30 rounded-lg text-sm text-error hover:bg-error/10 transition-colors">
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <button className="flex items-center gap-2 px-5 py-2.5 bg-[#7B68EE] hover:bg-[#6A5ACD] text-white font-medium rounded-lg transition-colors">
                <Plug className="w-4 h-4" />
                Connect ClickUp
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Future integrations hint */}
      <div className="bg-surface/50 border border-border/50 rounded-xl p-6 text-center">
        <p className="text-text-muted text-sm">
          More integrations coming soon: Jira, Asana, Linear, and more.
        </p>
      </div>
    </div>
  );
}
