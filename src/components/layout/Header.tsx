import React, { useRef, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { TabId } from '@/types/dashboard';

const TAB_LABELS: Record<TabId, string> = {
  home: 'Home',
  goals: 'Goals',
  growth: 'Growth',
  operations: 'Operations',
  insights: 'Insights',
  actions: 'Actions',
};

const PAGE_LABELS: Record<string, string> = {
  '/chat': 'Chat',
  '/settings': 'Settings',
  '/settings/profile': 'Settings',
  '/settings/security': 'Settings',
  '/settings/notifications': 'Settings',
  '/settings/appearance': 'Settings',
  '/settings/data-privacy': 'Settings',
  '/settings/data': 'Settings',
  '/billing': 'Billing',
  '/onboarding': 'Getting Started',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const activeTab = searchParams.get('tab') as TabId | null;
  // For dashboard tabs, show just the tab name; for other pages, show the page label
  const pageLabel = location.pathname === '/'
    ? (activeTab ? TAB_LABELS[activeTab] : 'Home')
    : (PAGE_LABELS[location.pathname] || 'Binee');

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
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex justify-between items-center px-6 py-3">
        {/* Page title */}
        <div className="flex items-center gap-2 text-sm">
          <h1 className="text-base font-semibold text-foreground">{pageLabel}</h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-[1.5px] border-background" />
            </button>
            {showNotifications && (
              <NotificationPanel onClose={() => setShowNotifications(false)} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
