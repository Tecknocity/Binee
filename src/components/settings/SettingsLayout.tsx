'use client';

import { useState } from 'react';
import { User, Users, Plug, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSettings from '@/components/settings/ProfileSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import BillingSettings from '@/components/settings/BillingSettings';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Your personal info' },
  { id: 'team', label: 'Team', icon: Users, description: 'Manage members' },
  { id: 'integrations', label: 'Integrations', icon: Plug, description: 'Connected apps' },
  { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Plans & credits' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your workspace settings and preferences</p>
      </div>

      {/* Tab navigation — pill style for better visual clarity */}
      <div className="flex gap-1 p-1 bg-surface/50 border border-border/50 rounded-xl mb-8 overflow-x-auto w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-accent/10 text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
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
