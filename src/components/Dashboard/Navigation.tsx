import React from 'react';
import { TabId } from '../../types/dashboard';
import { cn } from '@/lib/utils';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; badge?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'intelligence', label: 'Intelligence', badge: 'AI' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'operations', label: 'Operations' },
  { id: 'goals', label: 'Goals' },
  { id: 'issues', label: 'Issues' },
  { id: 'suggestions', label: 'Suggestions' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav 
      role="tablist" 
      aria-label="Dashboard sections" 
      className="bg-background/80 backdrop-blur-lg sticky top-[73px] z-40 border-b border-border/30"
    >
      <div className="flex gap-0 max-w-[1800px] mx-auto px-6 overflow-x-auto custom-scrollbar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id} 
              role="tab" 
              aria-selected={isActive} 
              aria-controls={`${tab.id}-panel`} 
              id={`${tab.id}-tab`} 
              onClick={() => onTabChange(tab.id)} 
              className={cn(
                "relative px-5 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 border-b-2 -mb-[1px]",
                isActive 
                  ? "text-foreground border-primary" 
                  : "text-muted-foreground hover:text-foreground border-transparent hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                  isActive 
                    ? "gradient-primary text-primary-foreground" 
                    : "bg-accent/15 text-accent"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
