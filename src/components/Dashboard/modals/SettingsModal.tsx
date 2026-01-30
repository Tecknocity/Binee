import React, { useState } from 'react';
import { Modal } from './Modal';
import { Settings, Bell, Puzzle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'notifications' | 'integrations' | 'security';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'security', label: 'Security', icon: Shield },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const inputClass = "w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="700px">
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-border pr-4">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id 
                    ? "bg-primary/15 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">General Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Company Name
                </label>
                <input 
                  type="text" 
                  defaultValue="Acme Corporation"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Timezone
                </label>
                <select defaultValue="UTC-5" className={inputClass}>
                  <option value="UTC-5">Eastern Time (UTC-5)</option>
                  <option value="UTC-8">Pacific Time (UTC-8)</option>
                  <option value="UTC+0">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Currency
                </label>
                <select defaultValue="USD" className={inputClass}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">Configure your notification preferences here.</p>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Connected Integrations</h3>
              <p className="text-sm text-muted-foreground">Manage your connected apps and services.</p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Security Settings</h3>
              <p className="text-sm text-muted-foreground">Manage your security and authentication settings.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button 
          onClick={onClose}
          className="px-5 py-2.5 bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={onClose}
          className="px-5 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all"
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
};
