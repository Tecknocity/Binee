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
      className="glass sticky top-[88px] z-40 border-b border-border/50 px-8"
    >
      <div className="flex gap-1 max-w-[1800px] mx-auto overflow-x-auto custom-scrollbar">
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
                "relative px-5 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2",
                isActive 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                  isActive 
                    ? "gradient-primary text-white" 
                    : "bg-accent/20 text-accent"
                )}>
                  {tab.badge}
                </span>
              )}
              
              {/* Active indicator */}
              <span 
                className={cn(
                  "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300",
                  isActive 
                    ? "w-full gradient-primary" 
                    : "w-0 bg-transparent"
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
