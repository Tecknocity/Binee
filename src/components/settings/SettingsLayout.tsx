'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, User, Shield, Users, ArrowLeft, Bell, CreditCard, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import GeneralSettings from '@/components/settings/GeneralSettings';
import AccountSettings from '@/components/settings/AccountSettings';
import PrivacySettings from '@/components/settings/PrivacySettings';
import TeamSettings from '@/components/settings/TeamSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import BillingSettings from '@/components/settings/BillingSettings';
import IntegrationsSettingsPage from '@/components/settings/IntegrationsSettingsPage';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'account', label: 'Account', icon: User },
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
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam && validTabs.has(tabParam) ? tabParam : 'general') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Sync tab from URL when navigating back to settings with a different ?tab=
  useEffect(() => {
    if (tabParam && validTabs.has(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    router.replace(`/settings?tab=${id}`, { scroll: false });
  };

  return (
    <div className="max-w-5xl mx-auto">
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

      <div className="flex gap-8">
        {/* Left sidebar nav */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
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

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'privacy' && <PrivacySettings />}
          {activeTab === 'team' && <TeamSettings />}
          {activeTab === 'billing' && <BillingSettings />}
          {activeTab === 'integrations' && <IntegrationsSettingsPage />}
        </div>
      </div>
    </div>
  );
}
