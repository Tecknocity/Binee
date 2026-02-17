import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { WidgetWrapperProps } from '../../types/dashboard';
import { cn } from '@/lib/utils';

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ widgetId, children, overviewWidgets, activeTab, onToggle }) => {
  const inOverview = overviewWidgets.includes(widgetId);
  const showButton = activeTab !== 'overview';

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle(widgetId);
  };

  return (
    <div className="relative group">
      {showButton && (
        <button
          onClick={handleToggleClick}
          aria-label={inOverview ? 'Remove from overview' : 'Add to overview'}
          title={inOverview ? 'Remove from overview' : 'Add to overview'}
          className={cn(
            "absolute top-4 right-4 z-20 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 pointer-events-auto cursor-pointer",
            "opacity-0 group-hover:opacity-100",
            inOverview
              ? "bg-success/15 border border-success/30 hover:bg-success/25"
              : "bg-primary/15 border border-primary/30 hover:bg-primary/25"
          )}
        >
          {inOverview
            ? <Eye size={16} className="text-success" />
            : <EyeOff size={16} className="text-primary" />
          }
        </button>
      )}
      {children}
    </div>
  );
};
