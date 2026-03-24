'use client';

import {
  ExternalLink,
  CheckCircle2,
  Loader2,
  Eye,
  PenLine,
  Users,
  Shield,
  Lock,
  ArrowRight,
} from 'lucide-react';

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
    description: 'View your spaces, folders, lists, and tasks to understand your workflow',
  },
  {
    icon: PenLine,
    label: 'Create & update tasks',
    description: 'Build workspace structures and manage tasks on your behalf',
  },
  {
    icon: Users,
    label: 'Read team members',
    description: 'See who\u2019s on your team so work is assigned to the right people',
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConnectClickUpStepProps {
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectClickUpStep({
  connected,
  loading,
  onConnect,
  onRefresh,
}: ConnectClickUpStepProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <p className="text-sm text-text-muted">Checking ClickUp connection…</p>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            ClickUp Connected
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your ClickUp workspace is linked and ready. Binee will now sync
            your data so it can start helping you.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-text-muted animate-pulse">
            <ArrowRight className="w-3.5 h-3.5" />
            Moving to next step…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 text-center max-w-lg">
        {/* ClickUp logo */}
        <div className="w-20 h-20 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center">
          <ClickUpLogo className="h-10 w-10 text-[#7B68EE]" />
        </div>

        {/* Title & subtitle */}
        <div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Connect Your ClickUp Workspace
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Binee connects to ClickUp to understand how your team works —
            then builds an intelligent workspace tailored to your business.
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
                  <p className="text-sm font-medium text-text-primary">
                    {item.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connect button — large & prominent */}
        <button
          onClick={onConnect}
          className="flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-xl text-base font-semibold transition-all bg-[#7B68EE] text-white hover:bg-[#6A5ACD] shadow-lg shadow-[#7B68EE]/20 hover:shadow-xl hover:shadow-[#7B68EE]/30 cursor-pointer"
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
              Tokens encrypted at rest
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm">
            Binee never stores your ClickUp password. Your credentials are
            encrypted and you can revoke access at any time from ClickUp
            settings.
          </p>
        </div>

        {/* Refresh hint */}
        <button
          onClick={onRefresh}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
        >
          Already connected? Click to refresh status
        </button>
      </div>
    </div>
  );
}
