'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useDashboard as useDashboardHook, type DashboardState } from '@/hooks/useDashboard';

const DashboardContext = createContext<DashboardState | null>(null);

/**
 * Provides dashboard state at the layout level so it persists across
 * page navigations. The underlying useDashboard hook fetches on mount
 * once and keeps its data alive as long as this provider is mounted.
 */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const state = useDashboardHook();
  return (
    <DashboardContext.Provider value={state}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardContext must be used within DashboardProvider');
  return ctx;
}
