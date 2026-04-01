'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { queryKeys } from '@/lib/query/keys';
import type { UserProfile } from '@/types/database';

type UserProfileData = Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const DEFAULTS: UserProfileData = {
  preferred_name: null,
  work_role: null,
  personal_preferences: null,
  timezone: 'America/New_York',
  avatar_url: null,
  notifications_enabled: true,
  notify_task_complete: true,
  notify_daily_standup: false,
  daily_standup_time: '08:00',
  notify_daily_digest: false,
  daily_digest_time: '18:00',
  allow_training: false,
  chat_history_enabled: true,
  onboarding_completed: false,
};

function mapDbProfile(data: Record<string, unknown>): UserProfileData {
  return {
    preferred_name: (data.preferred_name as string | null) ?? null,
    work_role: (data.work_role as string | null) ?? null,
    personal_preferences: (data.personal_preferences as string | null) ?? null,
    timezone: (data.timezone as string) ?? DEFAULTS.timezone,
    avatar_url: (data.avatar_url as string | null) ?? null,
    notifications_enabled: (data.notifications_enabled as boolean) ?? DEFAULTS.notifications_enabled,
    notify_task_complete: (data.notify_task_complete as boolean) ?? DEFAULTS.notify_task_complete,
    notify_daily_standup: (data.notify_daily_standup as boolean) ?? DEFAULTS.notify_daily_standup,
    daily_standup_time: (data.daily_standup_time as string) ?? DEFAULTS.daily_standup_time,
    notify_daily_digest: (data.notify_daily_digest as boolean) ?? DEFAULTS.notify_daily_digest,
    daily_digest_time: (data.daily_digest_time as string) ?? DEFAULTS.daily_digest_time,
    allow_training: (data.allow_training as boolean) ?? DEFAULTS.allow_training,
    chat_history_enabled: (data.chat_history_enabled as boolean) ?? DEFAULTS.chat_history_enabled,
    onboarding_completed: (data.onboarding_completed as boolean) ?? DEFAULTS.onboarding_completed,
  };
}

export function useUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();

  // -------------------------------------------------------------------------
  // Query: load profile
  // React Query handles: caching across navigations, stale-while-revalidate,
  // retry on failure, and automatic refetch after invalidation.
  // -------------------------------------------------------------------------

  const {
    data: profile = DEFAULTS,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: user ? queryKeys.userProfile(user.id) : ['userProfile', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (fine for new users)
        throw error;
      }

      return data ? mapDbProfile(data) : DEFAULTS;
    },
    enabled: !!user,
    // Keep profile cached for 30 minutes — settings data rarely changes
    gcTime: 30 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    // Keep previous data while refetching (prevents flash to defaults)
    placeholderData: (previousData) => previousData,
  });

  // -------------------------------------------------------------------------
  // Mutation: save profile (with optimistic update)
  // -------------------------------------------------------------------------

  const mutation = useMutation({
    mutationFn: async (updates: Partial<UserProfileData>) => {
      const payload = { ...updates, user_id: user!.id };
      const { error } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      return updates;
    },
    onMutate: async (updates) => {
      // Cancel in-flight fetches so they don't overwrite optimistic data
      if (user) await queryClient.cancelQueries({ queryKey: queryKeys.userProfile(user.id) });

      const key = user ? queryKeys.userProfile(user.id) : ['userProfile', 'none'];
      const previous = queryClient.getQueryData<UserProfileData>(key);

      // Optimistic update
      queryClient.setQueryData<UserProfileData>(key, (old) => ({
        ...(old ?? DEFAULTS),
        ...updates,
      }));

      return { previous };
    },
    onError: (_err, _updates, context) => {
      // Rollback on failure
      if (context?.previous && user) {
        queryClient.setQueryData(queryKeys.userProfile(user.id), context.previous);
      }
    },
  });

  const saveProfile = useCallback(
    async (updates: Partial<UserProfileData>) => {
      if (!user) return { error: 'Not authenticated' };
      try {
        await mutation.mutateAsync(updates);
        return {};
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed';
        console.error('[useUserProfile] save error:', message);
        return { error: message };
      }
    },
    [user, mutation],
  );

  return {
    profile,
    loading,
    saving: mutation.isPending,
    error: queryError?.message ?? (mutation.error as Error | null)?.message ?? null,
    saveProfile,
  };
}
