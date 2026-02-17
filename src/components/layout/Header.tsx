import React, { useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { UserDropdown } from './UserDropdown';
import { NotificationPanel } from './NotificationPanel';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'AI Chat',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
  '/settings/profile': 'Settings',
  '/settings/security': 'Settings',
  '/settings/notifications': 'Settings',
  '/settings/appearance': 'Settings',
  '/settings/data-privacy': 'Settings',
  '/billing': 'Billing',
  '/onboarding': 'Getting Started',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'Binee';

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (showNotifications && notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setShowNotifications(false);
    }
  }, [showNotifications]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40">
      <div className="flex justify-between items-center px-6 py-3">
        {/* Page title */}
        <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-background" />
            </button>
            {showNotifications && (
              <NotificationPanel onClose={() => setShowNotifications(false)} />
            )}
          </div>

          {/* User dropdown */}
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};
