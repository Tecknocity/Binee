'use client';

import { useState } from 'react';
import { User, Users, Plug, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSettings from '@/components/settings/ProfileSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import BillingSettings from '@/components/settings/BillingSettings';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Manage your workspace settings and preferences</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-light'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="max-w-3xl">
        {activeTab === 'profile' && <ProfileSettings />}
        {activeTab === 'team' && <TeamSettings />}
        {activeTab === 'integrations' && <IntegrationSettings />}
        {activeTab === 'billing' && <BillingSettings />}
      </div>
    </div>
  );
}
