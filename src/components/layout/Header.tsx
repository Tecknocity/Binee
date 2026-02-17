import React, { useRef, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { TabId } from '@/types/dashboard';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'Chat',
  '/tools/health-scorecard': 'Tools',
  '/tools/price-architect': 'Tools',
  '/integrations': 'Data',
  '/data-mapping': 'Data',
  '/data-quality': 'Data',
  '/settings': 'Settings',
  '/settings/profile': 'Settings',
  '/settings/security': 'Settings',
  '/settings/notifications': 'Settings',
  '/settings/appearance': 'Settings',
  '/settings/data-privacy': 'Settings',
  '/billing': 'Billing',
  '/onboarding': 'Getting Started',
};

const TAB_LABELS: Record<TabId, string> = {
  home: 'Home',
  growth: 'Growth',
  operations: 'Operations',
  insights: 'Insights',
  actions: 'Actions',
};

const PAGE_SUBTITLES: Record<string, string> = {
  '/tools/health-scorecard': 'Business Health Scorecard',
  '/tools/price-architect': 'Price Architect',
  '/integrations': 'Integrations',
  '/data-mapping': 'Data Mapping',
  '/data-quality': 'Data Quality & Issues',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'Binee';
  const activeTab = searchParams.get('tab') as TabId | null;
  const tabLabel = activeTab ? TAB_LABELS[activeTab] : location.pathname === '/' ? 'Home' : null;
  const pageSubtitle = PAGE_SUBTITLES[location.pathname] || null;

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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
          {(tabLabel || pageSubtitle) && (
            <>
              <span className="text-border">/</span>
              <span className="text-muted-foreground font-medium">{tabLabel || pageSubtitle}</span>
            </>
          )}
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
