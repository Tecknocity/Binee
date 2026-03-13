'use client';

import { useState } from 'react';
import { Save, Loader2, Bell, BellOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors shrink-0',
        enabled ? 'bg-accent' : 'bg-surface border border-border'
      )}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'left-5' : 'left-1'
        )}
      />
    </button>
  );
}

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ['00', '30']) {
      const val = `${String(h).padStart(2, '0')}:${m}`;
      times.push(val);
    }
  }

  return (
    <div className="relative">
      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'pl-8 pr-3 py-1.5 bg-navy-base border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {times.map((t) => {
          const [h, m] = t.split(':').map(Number);
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? 'AM' : 'PM';
          return (
            <option key={t} value={t}>
              {hour12}:{String(m).padStart(2, '0')} {ampm}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [taskComplete, setTaskComplete] = useState(true);
  const [dailyStandup, setDailyStandup] = useState(false);
  const [standupTime, setStandupTime] = useState('08:00');
  const [dailyDigest, setDailyDigest] = useState(false);
  const [digestTime, setDigestTime] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Master toggle */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Notifications</h2>
        <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
          <div className="flex items-center gap-3">
            {notificationsEnabled ? (
              <Bell className="w-5 h-5 text-accent" />
            ) : (
              <BellOff className="w-5 h-5 text-text-muted" />
            )}
            <div>
              <p className="text-sm font-medium text-text-primary">
                {notificationsEnabled ? 'Notifications are on' : 'Notifications are off'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Master toggle for all email notifications
              </p>
            </div>
          </div>
          <Toggle
            enabled={notificationsEnabled}
            onToggle={() => setNotificationsEnabled(!notificationsEnabled)}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Task completion notifications */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Activity Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Task completion</p>
              <p className="text-xs text-text-muted mt-0.5">
                Get an email when Binee finishes building a dashboard, running a setup, or completing an AI task you assigned.
              </p>
            </div>
            <Toggle
              enabled={taskComplete && notificationsEnabled}
              onToggle={() => setTaskComplete(!taskComplete)}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Scheduled notifications */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Scheduled Emails</h2>
        <div className="space-y-5">
          {/* Daily standup */}
          <div className="p-4 bg-surface border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-text-primary">Daily standup</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Every morning, receive an email with every task and a brief description of the work you need to do today.
                </p>
              </div>
              <Toggle
                enabled={dailyStandup && notificationsEnabled}
                onToggle={() => setDailyStandup(!dailyStandup)}
              />
            </div>
            {dailyStandup && notificationsEnabled && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-text-muted">Send at</span>
                <TimeSelect
                  value={standupTime}
                  onChange={setStandupTime}
                  disabled={!dailyStandup || !notificationsEnabled}
                />
                <span className="text-xs text-text-muted">your local time</span>
              </div>
            )}
          </div>

          {/* Daily digest */}
          <div className="p-4 bg-surface border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-text-primary">Daily digest</p>
                <p className="text-xs text-text-muted mt-0.5">
                  At the end of the day, receive an email with an overview of what happened -tasks completed, progress made, and anything that needs attention.
                </p>
              </div>
              <Toggle
                enabled={dailyDigest && notificationsEnabled}
                onToggle={() => setDailyDigest(!dailyDigest)}
              />
            </div>
            {dailyDigest && notificationsEnabled && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-text-muted">Send at</span>
                <TimeSelect
                  value={digestTime}
                  onChange={setDigestTime}
                  disabled={!dailyDigest || !notificationsEnabled}
                />
                <span className="text-xs text-text-muted">your local time</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            'Saved!'
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
