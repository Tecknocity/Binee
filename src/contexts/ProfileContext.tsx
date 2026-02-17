import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface ProfileState {
  name: string;
  email: string;
  company: string;
  role: string;
  timezone: string;
  avatar: string | null;
}

interface ProfileContextType extends ProfileState {
  updateProfile: (updates: Partial<ProfileState>) => void;
  initials: string;
}

const STORAGE_KEY = 'binee-profile';

const defaults: ProfileState = {
  name: 'John Doe',
  email: 'john@company.com',
  company: 'Binee Inc.',
  role: 'CEO & Founder',
  timezone: 'America/New_York',
  avatar: null,
};

function loadProfile(): ProfileState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load profile settings:', e);
  }
  return defaults;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ProfileContext = createContext<ProfileContextType>({
  ...defaults,
  updateProfile: () => {},
  initials: 'JD',
});

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProfileState>(loadProfile);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save profile settings:', e);
    }
  }, [state]);

  const updateProfile = useCallback((updates: Partial<ProfileState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const initials = getInitials(state.name);

  return (
    <ProfileContext.Provider value={{ ...state, updateProfile, initials }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
