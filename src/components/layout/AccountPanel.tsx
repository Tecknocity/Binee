import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  User,
  Settings,
  CreditCard,
  Plug,
  Database,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSection from '../settings/ProfileSection';
import SecuritySection from '../settings/SecuritySection';
import NotificationsSection from '../settings/NotificationsSection';
import AppearanceSection from '../settings/AppearanceSection';
import DataPrivacySection from '../settings/DataPrivacySection';
import IntegrationsPage from '../../pages/IntegrationsPage';
import { DataMappingSection } from './DataMappingSection';
import { DataQualitySection } from './DataQualitySection';
import BillingPage from '../../pages/BillingPage';

export type AccountSection = 'profile' | 'settings' | 'billing' | 'integrations' | 'data-mapping' | 'data-quality';

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: AccountSection;
}

const SETTINGS_SUBSECTIONS = [
  { id: 'security' as const, label: 'Security' },
  { id: 'notifications' as const, label: 'Notifications' },
  { id: 'appearance' as const, label: 'Appearance' },
  { id: 'data-privacy' as const, label: 'Data & Privacy' },
];

const ACCOUNT_NAV: { id: AccountSection; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'data-mapping', label: 'Data Mapping', icon: Database },
  { id: 'data-quality', label: 'Data Quality & Issues', icon: AlertCircle },
];

export const AccountPanel: React.FC<AccountPanelProps> = ({ isOpen, onClose, initialSection }) => {
  const [activeSection, setActiveSection] = useState<AccountSection>(initialSection || 'profile');
  const [settingsSubsection, setSettingsSubsection] = useState<string>('security');
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Update active section when initialSection prop changes
  useEffect(() => {
    if (initialSection && isOpen) {
      setActiveSection(initialSection);
    }
  }, [initialSection, isOpen]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection />;
      case 'settings':
        return (
          <div>
            {/* Settings sub-tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {SETTINGS_SUBSECTIONS.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSettingsSubsection(sub.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    settingsSubsection === sub.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {settingsSubsection === 'security' && <SecuritySection />}
            {settingsSubsection === 'notifications' && <NotificationsSection />}
            {settingsSubsection === 'appearance' && <AppearanceSection />}
            {settingsSubsection === 'data-privacy' && <DataPrivacySection />}
          </div>
        );
      case 'billing':
        return <BillingPage embedded />;
      case 'integrations':
        return <IntegrationsPage embedded />;
      case 'data-mapping':
        return <DataMappingSection />;
      case 'data-quality':
        return <DataQualitySection />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 h-full bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300",
          "w-full max-w-4xl",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Panel Navigation */}
          <nav className="w-56 flex-shrink-0 border-r border-border overflow-y-auto custom-scrollbar p-3">
            <div className="space-y-0.5">
              {ACCOUNT_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
