'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
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
};

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  // Load profile on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (cancelled) return;

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine for new users
        setError(fetchError.message);
      }

      if (data) {
        setProfile({
          preferred_name: data.preferred_name,
          work_role: data.work_role,
          personal_preferences: data.personal_preferences,
          timezone: data.timezone ?? DEFAULTS.timezone,
          avatar_url: data.avatar_url,
          notifications_enabled: data.notifications_enabled ?? DEFAULTS.notifications_enabled,
          notify_task_complete: data.notify_task_complete ?? DEFAULTS.notify_task_complete,
          notify_daily_standup: data.notify_daily_standup ?? DEFAULTS.notify_daily_standup,
          daily_standup_time: data.daily_standup_time ?? DEFAULTS.daily_standup_time,
          notify_daily_digest: data.notify_daily_digest ?? DEFAULTS.notify_daily_digest,
          daily_digest_time: data.daily_digest_time ?? DEFAULTS.daily_digest_time,
          allow_training: data.allow_training ?? DEFAULTS.allow_training,
          chat_history_enabled: data.chat_history_enabled ?? DEFAULTS.chat_history_enabled,
        });
      }

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [user, supabase]);

  // Upsert profile data
  const saveProfile = useCallback(async (updates: Partial<UserProfileData>) => {
    if (!user) return { error: 'Not authenticated' };

    setSaving(true);
    setError(null);

    const payload = { ...updates, user_id: user.id };

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return { error: upsertError.message };
    }

    // Update local state
    setProfile((prev) => ({ ...prev, ...updates }));
    return {};
  }, [user, supabase]);

  return { profile, loading, saving, error, saveProfile };
}
