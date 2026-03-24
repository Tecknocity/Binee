'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useClickUpStatus } from '@/hooks/useClickUpStatus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingStepNumber = 0 | 1 | 2;

export interface UseOnboardingReturn {
  /** Current step: 0=Welcome+Connect, 1=Sync, 2=Complete (redirect) */
  currentStep: OnboardingStepNumber;
  /** Whether onboarding should be shown */
  shouldShow: boolean;
  /** Whether we're still loading the onboarding state */
  loading: boolean;
  /** ClickUp connection state */
  clickUpConnected: boolean;
  clickUpLoading: boolean;
  /** Sync state */
  syncStarted: boolean;
  syncComplete: boolean;
  /** Actions */
  handleClickUpConnect: () => void;
  refreshClickUpStatus: () => Promise<void>;
  startSync: () => Promise<void>;
  onSyncComplete: () => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboarding(): UseOnboardingReturn {
  const router = useRouter();
  const { user } = useAuth();
  const { workspace_id } = useWorkspace();
  const clickUp = useClickUpStatus();

  const supabaseRef = useRef(createBrowserClient());

  const [currentStep, setCurrentStep] = useState<OnboardingStepNumber>(0);
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStarted, setSyncStarted] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const checkedRef = useRef(false);

  // Check if user needs onboarding
  useEffect(() => {
    if (!user || checkedRef.current) return;

    let cancelled = false;
    const supabase = supabaseRef.current;

    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();

      if (cancelled) return;
      checkedRef.current = true;

      // Show onboarding if no profile exists or onboarding not completed
      setShouldShow(!data || !data.onboarding_completed);
      setLoading(false);
    };

    checkOnboarding();
    return () => { cancelled = true; };
  }, [user]);

  const triggerSync = useCallback(async () => {
    if (!workspace_id || syncStarted) return;
    setSyncStarted(true);

    try {
      await fetch('/api/clickup/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id }),
      });
    } catch {
      // Sync may already be running — SyncProgress component will poll status
    }
  }, [workspace_id, syncStarted]);

  // Auto-advance from step 0 to step 1 when ClickUp connects
  useEffect(() => {
    if (!clickUp.loading && clickUp.connected && currentStep === 0) {
      const timer = setTimeout(() => {
        setCurrentStep(1);
        triggerSync();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [clickUp.connected, clickUp.loading, currentStep, triggerSync]);

  const handleClickUpConnect = useCallback(() => {
    if (!workspace_id) return;
    window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace_id)}`;
  }, [workspace_id]);

  const refreshClickUpStatus = useCallback(async () => {
    await clickUp.refetch();
  }, [clickUp]);

  const startSync = useCallback(async () => {
    await triggerSync();
  }, [triggerSync]);

  const onSyncComplete = useCallback(() => {
    setSyncComplete(true);
    // Auto-advance to final step after brief delay
    setTimeout(() => {
      setCurrentStep(2);
    }, 1500);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    if (!user) return;
    const supabase = supabaseRef.current;
    await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, onboarding_completed: true },
        { onConflict: 'user_id' }
      );
  }, [user]);

  const completeOnboarding = useCallback(async () => {
    await markOnboardingComplete();
    setShouldShow(false);
    router.push('/chat');
  }, [markOnboardingComplete, router]);

  const skipOnboarding = useCallback(async () => {
    await markOnboardingComplete();
    setShouldShow(false);
  }, [markOnboardingComplete]);

  return {
    currentStep,
    shouldShow,
    loading,
    clickUpConnected: clickUp.connected,
    clickUpLoading: clickUp.loading,
    syncStarted,
    syncComplete,
    handleClickUpConnect,
    refreshClickUpStatus,
    startSync,
    onSyncComplete,
    completeOnboarding,
    skipOnboarding,
  };
}
