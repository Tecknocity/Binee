import React from 'react';
import { Database } from 'lucide-react';
import { TabId, ViewMode } from '../../types/dashboard';
import { cn } from '@/lib/utils';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onMappingClick: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'goals', label: 'Goals' },
  { id: 'growth', label: 'Growth' },
  { id: 'operations', label: 'Operations' },
  { id: 'insights', label: 'Insights' },
  { id: 'actions', label: 'Actions' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, viewMode, onViewModeChange, onMappingClick }) => {
  return (
    <nav className="bg-background/80 backdrop-blur-lg sticky top-[57px] z-30 border-b border-border/30">
      <div className="flex justify-between items-center max-w-[1800px] mx-auto px-6">
        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto custom-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 border-b-2 -mb-[1px]",
                  isActive
                    ? "text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-muted-foreground/30"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-2 ml-4 flex-shrink-0">
          <button
            onClick={onMappingClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-info/40 text-info bg-info/5 hover:bg-info/10 transition-all text-xs font-medium"
          >
            <Database size={13} />
            Mapping
          </button>
          <div className="flex bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('company')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === 'company'
                  ? "gradient-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Company
            </button>
            <button
              onClick={() => onViewModeChange('binee')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === 'binee'
                  ? "gradient-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Binee
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
