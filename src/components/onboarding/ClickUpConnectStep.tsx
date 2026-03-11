'use client';

import { Plug, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

interface ClickUpConnectStepProps {
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}

export function ClickUpConnectStep({
  connected,
  loading,
  onConnect,
  onRefresh,
}: ClickUpConnectStepProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <p className="text-sm text-text-muted">Checking ClickUp connection...</p>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            ClickUp Connected
          </h2>
          <p className="text-sm text-text-secondary">
            Your ClickUp workspace is connected and ready. Let&apos;s set up your workspace structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-[#7B68EE]"
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

        {/* Title */}
        <div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Connect Your ClickUp
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            To set up your workspace, Binee needs access to your ClickUp account.
            We&apos;ll use this connection to create spaces, folders, lists, and tasks
            tailored to your business.
          </p>
        </div>

        {/* Connect button */}
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors bg-[#7B68EE] text-white hover:bg-[#6A5ACD] shadow-lg shadow-[#7B68EE]/20"
        >
          <Plug className="w-4 h-4" />
          Connect ClickUp
          <ExternalLink className="w-3.5 h-3.5 ml-1" />
        </button>

        {/* Refresh hint */}
        <button
          onClick={onRefresh}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Already connected? Click to refresh status
        </button>
      </div>
    </div>
  );
}
