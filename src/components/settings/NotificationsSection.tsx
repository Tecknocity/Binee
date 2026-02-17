import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface NotificationToggle {
  id: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

const EMAIL_NOTIFICATIONS: NotificationToggle[] = [
  {
    id: 'weekly-digest',
    label: 'Weekly business digest',
    description: 'Receive a summary of your business metrics every Monday',
    defaultValue: true,
  },
  {
    id: 'critical-alerts',
    label: 'Critical alerts',
    description: 'Get notified immediately about critical business issues',
    defaultValue: true,
  },
  {
    id: 'goal-updates',
    label: 'Goal updates',
    description: 'Email updates when goals are reached or fall behind',
    defaultValue: true,
  },
  {
    id: 'product-news',
    label: 'Product news',
    description: 'Learn about new features and platform improvements',
    defaultValue: false,
  },
];

const INAPP_NOTIFICATIONS: NotificationToggle[] = [
  {
    id: 'new-issues',
    label: 'New issues detected',
    description: 'Alert when AI detects potential business issues',
    defaultValue: true,
  },
  {
    id: 'goal-milestone',
    label: 'Goal milestone reached',
    description: 'Celebrate when you hit a goal milestone',
    defaultValue: true,
  },
  {
    id: 'sync-errors',
    label: 'Integration sync errors',
    description: 'Notify when an integration fails to sync',
    defaultValue: true,
  },
  {
    id: 'ai-suggestions',
    label: 'AI suggestions',
    description: 'Receive proactive AI-powered recommendations',
    defaultValue: true,
  },
];

const NotificationsSection: React.FC = () => {
  const [emailToggles, setEmailToggles] = useState<Record<string, boolean>>(() =>
    EMAIL_NOTIFICATIONS.reduce(
      (acc, item) => ({ ...acc, [item.id]: item.defaultValue }),
      {} as Record<string, boolean>
    )
  );

  const [inAppToggles, setInAppToggles] = useState<Record<string, boolean>>(() =>
    INAPP_NOTIFICATIONS.reduce(
      (acc, item) => ({ ...acc, [item.id]: item.defaultValue }),
      {} as Record<string, boolean>
    )
  );

  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');

  const handleEmailToggle = (id: string, checked: boolean) => {
    setEmailToggles((prev) => ({ ...prev, [id]: checked }));
    toast.success('Settings saved!');
  };

  const handleInAppToggle = (id: string, checked: boolean) => {
    setInAppToggles((prev) => ({ ...prev, [id]: checked }));
    toast.success('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Email Notifications */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Email Notifications</h3>
        <div className="space-y-5">
          {EMAIL_NOTIFICATIONS.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                checked={emailToggles[item.id]}
                onCheckedChange={(checked) => handleEmailToggle(item.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* In-App Notifications */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">In-App Notifications</h3>
        <div className="space-y-5">
          {INAPP_NOTIFICATIONS.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                checked={inAppToggles[item.id]}
                onCheckedChange={(checked) => handleInAppToggle(item.id, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Do Not Disturb */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Do Not Disturb</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Silence all notifications during the specified time window
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="dnd-start" className="block text-sm font-medium text-foreground mb-1.5">
              Start Time
            </label>
            <input
              id="dnd-start"
              type="time"
              value={dndStart}
              onChange={(e) => setDndStart(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <div className="flex items-end pb-2">
            <span className="text-muted-foreground text-sm font-medium">to</span>
          </div>
          <div className="flex-1">
            <label htmlFor="dnd-end" className="block text-sm font-medium text-foreground mb-1.5">
              End Time
            </label>
            <input
              id="dnd-end"
              type="time"
              value={dndEnd}
              onChange={(e) => setDndEnd(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsSection;
