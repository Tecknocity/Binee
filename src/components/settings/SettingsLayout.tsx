'use client';

import { useState } from 'react';
import { Settings, User, Shield, Users, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import GeneralSettings from '@/components/settings/GeneralSettings';
import AccountSettings from '@/components/settings/AccountSettings';
import PrivacySettings from '@/components/settings/PrivacySettings';
import TeamSettings from '@/components/settings/TeamSettings';

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'account', label: 'Account', icon: User },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'team', label: 'Team', icon: Users },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

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
                onClick={() => setActiveTab(tab.id)}
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
          {activeTab === 'privacy' && <PrivacySettings />}
          {activeTab === 'team' && <TeamSettings />}
        </div>
      </div>
    </div>
  );
}
