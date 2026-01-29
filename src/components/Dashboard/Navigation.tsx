import React from 'react';
import { TabId } from '../../types/dashboard';
import { theme } from '../../styles/theme';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; accentColor?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'intelligence', label: 'Intelligence', accentColor: true },
  { id: 'revenue', label: 'Revenue', accentColor: true },
  { id: 'operations', label: 'Operations', accentColor: true },
  { id: 'goals', label: 'Goals' },
  { id: 'issues', label: 'Issues' },
  { id: 'suggestions', label: 'Suggestions' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const getTabColor = (tab: (typeof TABS)[number], isActive: boolean) => {
    if (!isActive) return theme.colors.textSecondary;
    return tab.accentColor ? theme.colors.accent : theme.colors.primary;
  };

  const getBorderColor = (tab: (typeof TABS)[number], isActive: boolean) => {
    if (!isActive) return 'transparent';
    return tab.accentColor ? theme.colors.accent : theme.colors.primary;
  };

  return (
    <nav role="tablist" aria-label="Dashboard sections" style={{ background: 'rgba(15,23,42,0.8)', borderBottom: `1px solid ${theme.colors.mutedBorder}`, padding: `0 ${theme.spacing['3xl']}`, display: 'flex', gap: theme.spacing['2xl'] }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} role="tab" aria-selected={isActive} aria-controls={`${tab.id}-panel`} id={`${tab.id}-tab`} onClick={() => onTabChange(tab.id)} style={{ padding: `1.25rem 0`, background: 'transparent', border: 'none', borderBottom: `3px solid ${getBorderColor(tab, isActive)}`, color: getTabColor(tab, isActive), fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, cursor: 'pointer', transition: `all ${theme.transitions.normal}` }}>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
