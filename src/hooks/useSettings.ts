import { useState, useEffect, useCallback } from 'react';

interface NotificationSettings {
  emailWeeklyDigest: boolean;
  emailAlerts: boolean;
  emailProductUpdates: boolean;
  inAppTaskReminders: boolean;
  inAppSyncAlerts: boolean;
  inAppGoalUpdates: boolean;
}

interface BrandSettings {
  name: string;
  tagline: string;
  website: string;
  supportEmail: string;
}

interface ProfileSettings {
  name: string;
  email: string;
  timezone: string;
  avatar: string | null;
}

interface AppearanceSettings {
  density: 'comfortable' | 'compact';
  defaultTab: string;
  sidebarBehavior: 'expanded' | 'collapsed' | 'auto-hide';
}

interface AllSettings {
  profile: ProfileSettings;
  brand: BrandSettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
}

const defaultSettings: AllSettings = {
  profile: {
    name: 'John Doe',
    email: 'john@company.com',
    timezone: 'America/New_York',
    avatar: null,
  },
  brand: {
    name: 'Binee',
    tagline: 'AI-powered business intelligence',
    website: 'https://binee.lovable.app',
    supportEmail: 'support@binee.app',
  },
  notifications: {
    emailWeeklyDigest: true,
    emailAlerts: true,
    emailProductUpdates: false,
    inAppTaskReminders: true,
    inAppSyncAlerts: true,
    inAppGoalUpdates: true,
  },
  appearance: {
    density: 'comfortable',
    defaultTab: 'home',
    sidebarBehavior: 'expanded',
  },
};

const STORAGE_KEY = 'binee-settings';

export function useSettings() {
  const [settings, setSettingsState] = useState<AllSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
    return defaultSettings;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Auto-save to localStorage whenever settings change
  useEffect(() => {
    setIsSaving(true);
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
      setIsSaving(false);
    }, 500); // Debounce saves

    return () => clearTimeout(timeout);
  }, [settings]);

  const updateProfile = useCallback((updates: Partial<ProfileSettings>) => {
    setSettingsState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...updates },
    }));
  }, []);

  const updateBrand = useCallback((updates: Partial<BrandSettings>) => {
    setSettingsState((prev) => ({
      ...prev,
      brand: { ...prev.brand, ...updates },
    }));
  }, []);

  const updateNotifications = useCallback((updates: Partial<NotificationSettings>) => {
    setSettingsState((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates },
    }));
  }, []);

  const updateAppearance = useCallback((updates: Partial<AppearanceSettings>) => {
    setSettingsState((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...updates },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    settings,
    isSaving,
    updateProfile,
    updateBrand,
    updateNotifications,
    updateAppearance,
    resetSettings,
  };
}
