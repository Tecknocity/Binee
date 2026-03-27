'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, User, Shield, Users, ArrowLeft, Bell, CreditCard, Plug, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import GeneralSettings from '@/components/settings/GeneralSettings';
import AccountSettings from '@/components/settings/AccountSettings';
import PrivacySettings from '@/components/settings/PrivacySettings';
import TeamSettings from '@/components/settings/TeamSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import BillingPage from '@/components/settings/BillingPage';
import IntegrationsSettingsPage from '@/components/settings/IntegrationsSettingsPage';
import WorkspaceSettingsPage from '@/components/settings/WorkspaceSettingsPage';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'account', label: 'Account', icon: User },
  { id: 'workspace', label: 'Workspace', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Plug },
] as const;

type TabId = (typeof tabs)[number]['id'];

const validTabs = new Set<string>(tabs.map((t) => t.id));

export default function SettingsLayout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshWorkspace } = useAuth();
  const hasHandledOAuth = useRef(false);

  const tabParam = searchParams.get('tab');
  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');

  // If redirected from OAuth callback, default to integrations tab
  const hasOAuthResult = !!successParam || !!errorParam?.startsWith('clickup');
  const initialTab = (tabParam && validTabs.has(tabParam)
    ? tabParam
    : hasOAuthResult
      ? 'integrations'
      : 'general') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Sync tab from URL when navigating back to settings with a different ?tab=
  useEffect(() => {
    if (tabParam && validTabs.has(tabParam)) {
      setActiveTab(tabParam as TabId);
    }
    // Only react to URL changes — exclude activeTab to avoid circular updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // After ClickUp OAuth success, refresh workspace data so UI reflects connected state
  useEffect(() => {
    if (successParam === 'clickup_connected' && !hasHandledOAuth.current) {
      hasHandledOAuth.current = true;
      refreshWorkspace();
      // Clean up the URL query params
      router.replace('/settings?tab=integrations', { scroll: false });
    }
  }, [successParam, refreshWorkspace, router]);

  const handleTabChange = (id: TabId) => {
    // Update local state immediately for snappy UI, then sync URL
    setActiveTab(id);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  };

  // Memoize active content to prevent unmount/remount on re-renders.
  // Using useMemo ensures the JSX element is only recreated when activeTab changes,
  // not on every parent render (an IIFE would recreate the element every render).
  const activeContent = useMemo(() => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'account': return <AccountSettings />;
      case 'workspace': return <WorkspaceSettingsPage />;
      case 'notifications': return <NotificationSettings />;
      case 'privacy': return <PrivacySettings />;
      case 'team': return <TeamSettings />;
      case 'billing': return <BillingPage />;
      case 'integrations': return <IntegrationsSettingsPage />;
    }
  }, [activeTab]);

  return (
    <div className="w-full">
      <div className="mb-8">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
      </div>

      {/* Mobile: horizontal scrollable tabs */}
      <nav className="flex lg:hidden gap-1 overflow-x-auto pb-4 mb-6 border-b border-border/50 scrollbar-hide -mx-6 px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0',
                activeTab === tab.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex gap-10">
        {/* Left sidebar nav — desktop only */}
        <nav className="hidden lg:block w-52 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                <Icon className="w-4.5 h-4.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content — fills remaining space */}
        <div className="flex-1 min-w-0">
          {activeContent}
        </div>
      </div>
    </div>
  );
}
