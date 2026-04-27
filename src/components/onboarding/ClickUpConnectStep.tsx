'use client';

import { useState } from 'react';
import { ExternalLink, CheckCircle2, Loader2, Eye, PenLine, Users, Shield, Lock, AlertTriangle, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// ClickUp Logo SVG
// ---------------------------------------------------------------------------

function ClickUpLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
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
  );
}

// ---------------------------------------------------------------------------
// Access permissions Binee requests
// ---------------------------------------------------------------------------

const ACCESS_ITEMS = [
  {
    icon: Eye,
    label: 'Read tasks & projects',
    description: 'View your spaces, folders, lists, and tasks',
  },
  {
    icon: PenLine,
    label: 'Create & update tasks',
    description: 'Build workspace structures and manage tasks for you',
  },
  {
    icon: Users,
    label: 'Read team members',
    description: 'See who\'s on your team to assign work properly',
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClickUpConnectStepProps {
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onContinue?: () => void;
  teamName?: string | null;
  isRevisit?: boolean;
  isRefreshing?: boolean;
  /** True when user has progressed past Connect (so reconnecting will discard work) */
  hasProgress?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClickUpConnectStep({
  connected,
  loading,
  onConnect,
  onRefresh,
  onContinue,
  teamName,
  isRevisit,
  isRefreshing,
  hasProgress = false,
}: ClickUpConnectStepProps) {
  const [showReconnectConfirm, setShowReconnectConfirm] = useState(false);

  // Trigger OAuth, but warn first if reconnecting will wipe progress
  const requestConnect = () => {
    if (hasProgress) {
      setShowReconnectConfirm(true);
    } else {
      onConnect();
    }
  };

  const reconnectModal = showReconnectConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-navy-dark border border-border rounded-2xl w-full max-w-md flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Reconnect will reset all progress
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReconnectConfirm(false)}
            className="p-1.5 text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-text-primary leading-relaxed">
            Connecting a different ClickUp workspace will clear your entire setup.
            You will start over from step 1.
          </p>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs font-medium text-text-primary mb-2">You will lose:</p>
            <ul className="text-xs text-text-secondary space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                <span>Workspace analysis results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                <span>Business profile and chat history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                <span>Generated structure plan</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                <span>Build progress and manual steps</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={() => setShowReconnectConfirm(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setShowReconnectConfirm(false);
              onConnect();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Reset and reconnect
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <p className="text-sm text-text-muted">Checking ClickUp connection...</p>
          </div>
        </div>
        {reconnectModal}
      </>
    );
  }

  if (connected) {
    return (
      <>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          {/* Connection status card */}
          <div className="w-full rounded-xl border border-success/20 bg-success/5 p-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center">
                <ClickUpLogo className="h-6 w-6 text-[#7B68EE]" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    {teamName || 'ClickUp Workspace'}
                  </h3>
                  <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  OAuth 2.0 secured connection
                </p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              {isRevisit ? 'ClickUp Connected' : 'Connection Successful!'}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {isRevisit
                ? 'Your ClickUp workspace is connected. You can switch to a different workspace or continue where you left off.'
                : 'Your ClickUp workspace is connected and ready. Let\'s set up your workspace structure.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 w-full">
            {/* First visit: auto-advancing indicator */}
            {!isRevisit && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span>Preparing workspace analysis...</span>
              </div>
            )}

            {/* Continue button - shown when connected and revisiting */}
            {isRevisit && onContinue && (
              <button
                onClick={onContinue}
                className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-xl text-base font-semibold transition-all
                  bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
              >
                Continue to Analysis
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}

            {isRevisit && (
              <>
                <button
                  onClick={requestConnect}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-medium transition-all
                    border border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                >
                  <ClickUpLogo className="w-4 h-4" />
                  Connect Different Workspace
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </button>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  {isRefreshing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isRefreshing ? 'Refreshing...' : 'Refresh connection status'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {reconnectModal}
      </>
    );
  }

  return (
    <>
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 text-center max-w-lg">
        {/* ClickUp Logo */}
        <div className="w-20 h-20 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center">
          <ClickUpLogo className="h-10 w-10 text-[#7B68EE]" />
        </div>

        {/* Title & subtitle */}
        <div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Connect Your ClickUp
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Binee connects to ClickUp to understand your workflow and build
            a workspace structure tailored to your business.
          </p>
        </div>

        {/* What Binee will access */}
        <div className="w-full rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4 text-left">
            What Binee will access
          </h3>
          <div className="space-y-4">
            {ACCESS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-start gap-3 text-left">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connect button — large & prominent */}
        <button
          onClick={requestConnect}
          className="flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-xl text-base font-semibold transition-all bg-[#7B68EE] text-white hover:bg-[#6A5ACD] shadow-lg shadow-[#7B68EE]/20 hover:shadow-xl hover:shadow-[#7B68EE]/30"
        >
          <ClickUpLogo className="w-5 h-5" />
          Connect ClickUp
          <ExternalLink className="w-4 h-4 ml-0.5 opacity-70" />
        </button>

        {/* Privacy assurance */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              OAuth 2.0 secured
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Encrypted tokens
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm">
            Binee never stores your ClickUp password. You can revoke access
            at any time from your ClickUp settings.
          </p>
        </div>

        {/* Refresh hint */}
        <button
          onClick={onRefresh}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Already connected? Click to refresh status
        </button>
      </div>
    </div>
    {reconnectModal}
    </>
  );
}
