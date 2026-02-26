import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/contexts/AppearanceContext';

export const AppShell: React.FC = () => {
  const { sidebarBehavior, density } = useAppearance();

  // Derive collapsed state from the persisted sidebar behavior setting
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    sidebarBehavior === 'collapsed' || sidebarBehavior === 'auto-hide'
  );
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Sync collapsed state when the setting changes
  useEffect(() => {
    setSidebarCollapsed(
      sidebarBehavior === 'collapsed' || sidebarBehavior === 'auto-hide'
    );
  }, [sidebarBehavior]);

  const handleToggle = useCallback(() => {
    // Manual toggle only applies in expanded/collapsed modes
    if (sidebarBehavior !== 'auto-hide') {
      setSidebarCollapsed((prev) => !prev);
    }
  }, [sidebarBehavior]);

  const handleSidebarMouseEnter = useCallback(() => {
    if (sidebarBehavior === 'auto-hide') {
      setSidebarHovered(true);
    }
  }, [sidebarBehavior]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (sidebarBehavior === 'auto-hide') {
      setSidebarHovered(false);
    }
  }, [sidebarBehavior]);

  // In auto-hide mode, the sidebar is visually expanded when hovered
  const isAutoHide = sidebarBehavior === 'auto-hide';
  const effectiveCollapsed = isAutoHide ? !sidebarHovered : sidebarCollapsed;

  // For auto-hide, the content area does NOT shift — sidebar overlays
  const contentMargin = isAutoHide
    ? 'ml-[68px]'
    : effectiveCollapsed
      ? 'ml-[68px]'
      : 'ml-[260px]';

  return (
    <div className={cn(
      "min-h-screen bg-background text-foreground",
      density === 'compact' && 'density-compact'
    )}>
      <div
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <Sidebar
          collapsed={effectiveCollapsed}
          onToggle={handleToggle}
          autoHide={isAutoHide}
        />
      </div>
      <div
        className={cn(
          "transition-all duration-300 min-h-screen",
          contentMargin
        )}
      >
        <Header />
        <main className="animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
