import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { WidgetWrapperProps } from '../../types/dashboard';
import { theme } from '../../styles/theme';

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children, overviewWidgets, activeTab, onToggle }) => {
  const inOverview = overviewWidgets.includes(widgetId);
  const showButton = activeTab !== 'overview';

  return (
    <div style={{ position: 'relative' }}>
      {showButton && (
        <button onClick={() => onToggle(widgetId)} aria-label={inOverview ? 'Remove from overview' : 'Add to overview'} title={inOverview ? 'Remove from overview' : 'Add to overview'} style={{ position: 'absolute', top: theme.spacing.lg, right: theme.spacing.lg, zIndex: 10, width: '36px', height: '36px', borderRadius: theme.borderRadius.md, background: inOverview ? theme.colors.successLight : theme.colors.primaryLight, border: inOverview ? `1px solid ${theme.colors.successBorder}` : `1px solid ${theme.colors.primaryBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `all ${theme.transitions.normal}` }}>
          {inOverview ? <Eye size={18} color={theme.colors.success} /> : <EyeOff size={18} color={theme.colors.primary} />}
        </button>
      )}
      {children}
    </div>
  );
};
