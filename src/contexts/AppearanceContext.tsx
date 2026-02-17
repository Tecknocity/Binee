import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type DensityOption = 'comfortable' | 'compact';
export type SidebarBehavior = 'expanded' | 'collapsed' | 'auto-hide';

interface AppearanceState {
  density: DensityOption;
  defaultTab: string;
  sidebarBehavior: SidebarBehavior;
}

interface AppearanceContextType extends AppearanceState {
  setDensity: (density: DensityOption) => void;
  setDefaultTab: (tab: string) => void;
  setSidebarBehavior: (behavior: SidebarBehavior) => void;
}

const STORAGE_KEY = 'binee-appearance';

const defaults: AppearanceState = {
  density: 'comfortable',
  defaultTab: 'home',
  sidebarBehavior: 'expanded',
};

function loadAppearance(): AppearanceState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load appearance settings:', e);
  }
  return defaults;
}

const AppearanceContext = createContext<AppearanceContextType>({
  ...defaults,
  setDensity: () => {},
  setDefaultTab: () => {},
  setSidebarBehavior: () => {},
});

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppearanceState>(loadAppearance);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save appearance settings:', e);
    }
  }, [state]);

  const setDensity = useCallback((density: DensityOption) => {
    setState((prev) => ({ ...prev, density }));
  }, []);

  const setDefaultTab = useCallback((defaultTab: string) => {
    setState((prev) => ({ ...prev, defaultTab }));
  }, []);

  const setSidebarBehavior = useCallback((sidebarBehavior: SidebarBehavior) => {
    setState((prev) => ({ ...prev, sidebarBehavior }));
  }, []);

  return (
    <AppearanceContext.Provider
      value={{ ...state, setDensity, setDefaultTab, setSidebarBehavior }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => useContext(AppearanceContext);
