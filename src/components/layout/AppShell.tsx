import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

export const AppShell: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className={cn(
          "transition-all duration-300 min-h-screen",
          sidebarCollapsed ? "ml-[68px]" : "ml-[260px]"
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
