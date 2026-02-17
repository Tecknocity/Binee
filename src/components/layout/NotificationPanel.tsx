import React from 'react';
import { AlertCircle, Target, AlertTriangle, Lightbulb, Info, Check } from 'lucide-react';

interface Notification {
  id: string;
  type: 'issue' | 'goal' | 'sync-error' | 'suggestion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'issue', title: 'Critical: Pipeline Coverage Low', message: 'Pipeline coverage dropped below 2x. Review your active deals.', read: false, createdAt: '2026-02-17T08:30:00Z' },
  { id: 'n2', type: 'goal', title: 'Goal Milestone Reached', message: 'MRR goal reached 85% of target. Keep it up!', read: false, createdAt: '2026-02-16T14:00:00Z' },
  { id: 'n3', type: 'sync-error', title: 'Sync Warning: QuickBooks', message: 'QuickBooks sync encountered 3 warnings. Check integration settings.', read: false, createdAt: '2026-02-16T10:15:00Z' },
  { id: 'n4', type: 'suggestion', title: 'New AI Suggestion', message: 'Restructure pipeline stages to unlock industry benchmarks.', read: true, createdAt: '2026-02-15T16:00:00Z' },
  { id: 'n5', type: 'system', title: 'Welcome to Binee!', message: 'Your command center is ready. Connect tools to get started.', read: true, createdAt: '2026-02-14T09:00:00Z' },
];

const ICON_MAP = {
  issue: AlertCircle,
  goal: Target,
  'sync-error': AlertTriangle,
  suggestion: Lightbulb,
  system: Info,
};

const COLOR_MAP = {
  issue: 'text-destructive',
  goal: 'text-success',
  'sync-error': 'text-warning',
  suggestion: 'text-primary',
  system: 'text-info',
};

interface NotificationPanelProps {
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const [notifications, setNotifications] = React.useState(MOCK_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-card rounded-xl border border-border shadow-xl animate-scale-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Check size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.map((notif) => {
          const Icon = ICON_MAP[notif.type];
          return (
            <div
              key={notif.id}
              className={`flex gap-3 px-4 py-3 border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${
                !notif.read ? 'bg-primary/5' : ''
              }`}
            >
              <div className={`mt-0.5 ${COLOR_MAP[notif.type]}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!notif.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(notif.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
