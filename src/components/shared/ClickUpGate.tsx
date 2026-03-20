'use client';

import { Plug, ExternalLink } from 'lucide-react';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useWorkspace } from '@/hooks/useWorkspace';

interface ClickUpGateProps {
  children: React.ReactNode;
}

/**
 * Wraps a page and shows a blurred overlay with a "Connect ClickUp" prompt
 * when the user's ClickUp workspace is not connected.
 * Renders children normally when connected (or still loading).
 */
export function ClickUpGate({ children }: ClickUpGateProps) {
  const { connected, loading } = useClickUpStatus();
  const { workspace_id } = useWorkspace();

  // While loading, render the page normally (avoids flash)
  if (loading) {
    return <>{children}</>;
  }

  if (connected) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred background content */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="rounded-2xl bg-surface border border-border p-10 shadow-2xl max-w-md text-center">
          {/* ClickUp icon */}
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-[#7B68EE]/10 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-[#7B68EE]"
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

          <h2 className="text-xl font-semibold text-text-primary mb-3">
            Connect Your ClickUp
          </h2>

          <p className="text-sm text-text-secondary leading-relaxed mb-6">
            We can&apos;t show you data because your ClickUp workspace is not connected.
            Connect your account so Binee can sync your tasks, projects, and team
            activity to power your dashboards and insights.
          </p>

          <a
            href={workspace_id ? `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}` : '/settings'}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors bg-[#7B68EE] text-white hover:bg-[#6A5ACD] shadow-lg shadow-[#7B68EE]/20"
          >
            <Plug className="w-4 h-4" />
            Connect ClickUp
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>

          <p className="text-xs text-text-muted mt-4">
            You can also connect from{' '}
            <a
              href="/settings"
              className="text-accent hover:underline"
            >
              Settings
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
