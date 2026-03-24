'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  MessageSquare,
  ClipboardList,
  LayoutDashboard,
  PartyPopper,
  Sparkles,
  FolderOpen,
  Folder,
  List,
} from 'lucide-react';
import type { ExecutionResult } from '@/lib/setup/session';
import type { SetupPlan } from '@/lib/setup/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetupCompleteProps {
  executionResult: ExecutionResult | null;
  manualStepsCount: number;
  plan: SetupPlan | null;
  onViewManualSteps?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countStructure(plan: SetupPlan | null) {
  if (!plan) return { spaces: 0, folders: 0, lists: 0 };
  let folders = 0;
  let lists = 0;
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      folders++;
      lists += folder.lists.length;
    }
  }
  return { spaces: plan.spaces.length, folders, lists };
}

const CONFETTI_COUNT = 40;
const REDIRECT_SECONDS = 5;

// ---------------------------------------------------------------------------
// Confetti colors — matches design system accent palette
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#854DF9', '#3B82F6', '#10B981', '#F59E0B', '#9D6FFA', '#6B3AD4'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupComplete({
  executionResult,
  manualStepsCount,
  plan,
  onViewManualSteps,
}: SetupCompleteProps) {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [redirectPaused, setRedirectPaused] = useState(false);

  const structure = useMemo(() => countStructure(plan), [plan]);

  // Pre-generate confetti particle styles to avoid Math.random in render
  const confettiStyles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        left: `${(((i * 7 + 13) * 17) % 100)}%`,
        top: '-5%',
        width: `${4 + ((i * 3 + 5) % 7)}px`,
        height: `${4 + ((i * 5 + 3) % 7)}px`,
        backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        animationDelay: `${((i * 11) % 25) / 10}s`,
        animationDuration: `${2.5 + ((i * 7) % 20) / 10}s`,
        opacity: 0.85,
      })),
    []
  );

  // Trigger confetti after mount
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Countdown & auto-redirect to /chat
  useEffect(() => {
    if (redirectPaused) return;
    if (countdown <= 0) {
      router.push('/chat');
      return;
    }
    const interval = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, redirectPaused, router]);

  const pauseRedirect = useCallback(() => {
    setRedirectPaused(true);
  }, []);

  const goToChat = useCallback(() => {
    router.push('/chat');
  }, [router]);

  const goToDashboard = useCallback(() => {
    setRedirectPaused(true);
    router.push('/');
  }, [router]);

  const handleViewManualSteps = useCallback(() => {
    setRedirectPaused(true);
    onViewManualSteps?.();
  }, [onViewManualSteps]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 pb-6">
      {/* Confetti particles */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiStyles.map((style, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-confetti"
              style={style}
            />
          ))}
        </div>
      )}

      {/* Success icon with celebration badge */}
      <div className="relative mb-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center animate-bounce">
          <PartyPopper className="w-4 h-4 text-accent" />
        </div>
        <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-warning" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-text-primary mb-2">Your workspace is ready!</h1>
      <p className="text-text-secondary text-center mb-6 max-w-md">
        {executionResult ? (
          <>
            Successfully created{' '}
            <span className="text-text-primary font-medium">
              {executionResult.itemsCreated} items
            </span>{' '}
            in your ClickUp workspace.
          </>
        ) : (
          'Your ClickUp workspace is fully set up and ready to go.'
        )}
      </p>

      {/* Workspace structure summary */}
      {(structure.spaces > 0 || (executionResult && executionResult.itemsCreated > 0)) && (
        <div className="w-full bg-surface border border-border rounded-xl p-4 mb-6">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            What was created
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5 bg-accent/5 rounded-lg px-3 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary font-mono tabular-nums leading-tight">
                  {structure.spaces}
                </p>
                <p className="text-[11px] text-text-muted">
                  Space{structure.spaces !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-info/5 rounded-lg px-3 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-info/15 flex items-center justify-center flex-shrink-0">
                <Folder className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary font-mono tabular-nums leading-tight">
                  {structure.folders}
                </p>
                <p className="text-[11px] text-text-muted">
                  Folder{structure.folders !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-success/5 rounded-lg px-3 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center flex-shrink-0">
                <List className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary font-mono tabular-nums leading-tight">
                  {structure.lists}
                </p>
                <p className="text-[11px] text-text-muted">
                  List{structure.lists !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div className="w-full space-y-3 mb-6">
        {/* Primary: Start chatting */}
        <button
          onClick={goToChat}
          className="w-full flex items-center justify-center gap-2.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white font-semibold rounded-xl px-5 py-3.5 transition-colors shadow-lg shadow-accent/20"
        >
          <MessageSquare className="w-5 h-5" />
          Start chatting with Binee
          {!redirectPaused && countdown > 0 && (
            <span className="text-white/60 text-sm font-normal ml-1">({countdown}s)</span>
          )}
        </button>

        {/* Secondary row */}
        <div className="grid grid-cols-2 gap-3">
          {/* View manual steps */}
          {onViewManualSteps && manualStepsCount > 0 && (
            <button
              onClick={handleViewManualSteps}
              onMouseEnter={pauseRedirect}
              className="flex items-center justify-center gap-2 bg-surface border border-border hover:border-accent/30 text-text-primary font-medium rounded-xl px-4 py-3 transition-colors text-sm"
            >
              <ClipboardList className="w-4 h-4 text-text-secondary" />
              View manual steps
            </button>
          )}

          {/* Go to dashboard */}
          <button
            onClick={goToDashboard}
            onMouseEnter={pauseRedirect}
            className={`flex items-center justify-center gap-2 bg-surface border border-border hover:border-accent/30 text-text-primary font-medium rounded-xl px-4 py-3 transition-colors text-sm ${
              !onViewManualSteps || manualStepsCount === 0 ? 'col-span-2' : ''
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-text-secondary" />
            Go to dashboard
          </button>
        </div>
      </div>

      {/* Redirect notice */}
      {!redirectPaused && countdown > 0 && (
        <p className="text-xs text-text-muted">
          Redirecting to chat in {countdown}s...{' '}
          <button
            onClick={pauseRedirect}
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            Cancel
          </button>
        </p>
      )}
    </div>
  );
}
