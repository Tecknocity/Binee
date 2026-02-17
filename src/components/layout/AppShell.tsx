import React, { useState, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AccountPanel, AccountSection } from './AccountPanel';
import { AccountPanelProvider } from '@/contexts/AccountPanelContext';
import { cn } from '@/lib/utils';

export const AppShell: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSection, setAccountSection] = useState<AccountSection>('profile');

  const handleOpenAccount = (section?: string) => {
    if (section) {
      setAccountSection(section as AccountSection);
    }
    setAccountOpen(true);
  };

  const accountPanelValue = useMemo(() => ({
    openAccount: handleOpenAccount,
  }), []);

  return (
    <AccountPanelProvider value={accountPanelValue}>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenAccount={handleOpenAccount}
        />
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
        <AccountPanel
          isOpen={accountOpen}
          onClose={() => setAccountOpen(false)}
          initialSection={accountSection}
        />
      </div>
    </AccountPanelProvider>
  );
};
