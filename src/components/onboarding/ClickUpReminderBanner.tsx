'use client';

import { useState, useEffect, useRef } from 'react';
import { Plug, X, ArrowRight } from 'lucide-react';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// ClickUp Reminder Banner
// Shows when the user skipped onboarding and ClickUp is not yet connected.
// Dismissible for the session via localStorage.
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'binee:clickup-reminder-dismissed';

export default function ClickUpReminderBanner() {
  const { user } = useAuth();
  const { workspace_id } = useWorkspace();
  const clickUp = useClickUpStatus();
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  // Check if user skipped onboarding
  useEffect(() => {
    if (!user || checkedRef.current) return;

    let cancelled = false;
    const supabase = createBrowserClient();

    const check = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_skipped_at')
        .eq('user_id', user.id)
        .single();

      if (cancelled) return;
      checkedRef.current = true;

      setSkippedOnboarding(!!data?.onboarding_skipped_at);

      // Check localStorage for session dismissal
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        // Re-show after 24 hours
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        setDismissed(elapsed < 24 * 60 * 60 * 1000);
      } else {
        setDismissed(false);
      }

      setLoading(false);
    };

    check();
    return () => { cancelled = true; };
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  const handleConnect = () => {
    if (!workspace_id) return;
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}`;
  };

  // Don't render if: still loading, already connected, didn't skip, or dismissed
  if (loading || clickUp.loading || clickUp.connected || !skippedOnboarding || dismissed) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-accent/20 bg-accent/5 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
          <Plug className="w-3.5 h-3.5 text-accent" />
        </div>
        <p className="text-sm text-text-secondary truncate">
          Connect ClickUp to unlock workspace insights, task tracking, and team analytics.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Connect now
          <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
          aria-label="Dismiss reminder"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
