'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import {
  Plug,
  ExternalLink,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useWorkspace } from '@/hooks/useWorkspace';
import { OnboardingStepIndicator, type OnboardingStepConfig } from './OnboardingStep';
import { SyncProgress } from './SyncProgress';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS: OnboardingStepConfig[] = [
  { label: 'Connect', number: 0 },
  { label: 'Sync', number: 1 },
  { label: 'Chat', number: 2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingFlow() {
  const onboarding = useOnboarding();
  const { workspace_id } = useWorkspace();

  // If onboarding shouldn't show, render nothing
  if (!onboarding.shouldShow) return null;

  return (
    <div className="fixed inset-0 z-50 bg-navy-base flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center overflow-hidden">
            <Image src="/Binee__icon__white.svg" alt="Binee" width={22} height={22} unoptimized />
          </div>
          <span className="text-sm font-semibold text-text-primary">Binee</span>
        </div>
        <button
          onClick={onboarding.skipOnboarding}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip for now
        </button>
      </div>

      {/* Step indicator */}
      <div className="px-6 pt-8 pb-4">
        <OnboardingStepIndicator steps={STEPS} currentStep={onboarding.currentStep} />
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {onboarding.currentStep === 0 && (
          <WelcomeConnectStep
            connected={onboarding.clickUpConnected}
            loading={onboarding.clickUpLoading}
            onConnect={onboarding.handleClickUpConnect}
            onRefresh={onboarding.refreshClickUpStatus}
          />
        )}

        {onboarding.currentStep === 1 && workspace_id && (
          <SyncStep
            workspaceId={workspace_id}
            onComplete={onboarding.onSyncComplete}
            syncComplete={onboarding.syncComplete}
          />
        )}

        {onboarding.currentStep === 2 && (
          <ReadyStep onStart={onboarding.completeOnboarding} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome + Connect ClickUp
// ---------------------------------------------------------------------------

function WelcomeConnectStep({
  connected,
  loading,
  onConnect,
  onRefresh,
}: {
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
          <p className="text-sm text-text-muted">Checking connection...</p>
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
          <h2 className="text-xl font-semibold text-text-primary">ClickUp Connected!</h2>
          <p className="text-sm text-text-secondary">
            Great — syncing your workspace data now...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 text-center max-w-lg">
        {/* Welcome */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome to Binee
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed max-w-md">
            Your AI-powered workspace intelligence platform. Let&apos;s get you set up
            in under 2 minutes. First, connect your ClickUp workspace so Binee can
            understand how your team works.
          </p>
        </div>

        {/* Connect card */}
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#7B68EE]" fill="none">
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

            <button
              onClick={onConnect}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors bg-[#7B68EE] text-white hover:bg-[#6A5ACD] shadow-lg shadow-[#7B68EE]/20"
            >
              <Plug className="w-4 h-4" />
              Connect ClickUp
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </button>

            <button
              onClick={onRefresh}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Already connected? Click to refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Sync Progress
// ---------------------------------------------------------------------------

function SyncStep({
  workspaceId,
  onComplete,
  syncComplete,
}: {
  workspaceId: string;
  onComplete: () => void;
  syncComplete: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <SyncProgress workspaceId={workspaceId} onComplete={onComplete} variant="onboarding" />

        {syncComplete && (
          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary animate-pulse">
              Preparing your workspace...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Ready — Redirect to First Chat
// ---------------------------------------------------------------------------

function ReadyStep({ onStart }: { onStart: () => void }) {
  // Auto-redirect after a short delay so users see the success state
  useEffect(() => {
    const timer = setTimeout(onStart, 3000);
    return () => clearTimeout(timer);
  }, [onStart]);

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            You&apos;re all set!
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your workspace is synced and ready. Binee can now answer questions
            about your tasks, team workload, and project health.
          </p>
        </div>

        <button
          onClick={onStart}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
        >
          <MessageSquare className="w-4 h-4" />
          Start your first chat
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-text-muted animate-pulse">
          Redirecting automatically...
        </p>
      </div>
    </div>
  );
}
