'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Monitor, Moon, Sun, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ColorMode = 'light' | 'auto' | 'dark';

const colorModes: { id: ColorMode; label: string; icon: typeof Sun; description: string }[] = [
  { id: 'light', label: 'Light', icon: Sun, description: 'Always use light theme' },
  { id: 'auto', label: 'Auto', icon: Monitor, description: 'Match system setting' },
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark theme' },
];

export default function GeneralSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [preferredName, setPreferredName] = useState(user?.display_name?.split(' ')[0] || '');
  const [workRole, setWorkRole] = useState('Operations');
  const [personalPreferences, setPersonalPreferences] = useState('');
  const [colorMode, setColorMode] = useState<ColorMode>('dark');
  const [responseNotifications, setResponseNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
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

  const initials = (displayName || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Profile section */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Profile</h2>
        <div className="space-y-4">
          {/* Full name + preferred name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Full name
              </label>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                  <span className="text-accent text-xs font-bold">{initials}</span>
                </div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                What should Binee call you?
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          {/* Work role */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              What best describes your work?
            </label>
            <select
              value={workRole}
              onChange={(e) => setWorkRole(e.target.value)}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors"
            >
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Personal preferences */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              What personal preferences should Binee consider in responses?
            </label>
            <p className="text-xs text-text-muted mb-2">
              Your preferences will apply to all conversations.
            </p>
            <textarea
              value={personalPreferences}
              onChange={(e) => setPersonalPreferences(e.target.value)}
              placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
              rows={3}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Notifications */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Response completions</p>
              <p className="text-xs text-text-muted mt-0.5">
                Get notified when Binee has finished a response.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResponseNotifications(!responseNotifications)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors',
                responseNotifications ? 'bg-accent' : 'bg-surface border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  responseNotifications ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Email notifications</p>
              <p className="text-xs text-text-muted mt-0.5">
                Get an email when Binee has finished building or needs your response.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors',
                emailNotifications ? 'bg-accent' : 'bg-surface border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  emailNotifications ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Appearance */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Appearance</h2>
        <p className="text-sm text-text-secondary mb-3">Color mode</p>
        <div className="flex gap-4">
          {colorModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = colorMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setColorMode(mode.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all w-28',
                  isActive
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface hover:border-border-light'
                )}
              >
                <div
                  className={cn(
                    'w-16 h-10 rounded-lg border flex items-center justify-center',
                    mode.id === 'light'
                      ? 'bg-gray-100 border-gray-200'
                      : mode.id === 'dark'
                        ? 'bg-navy-dark border-border'
                        : 'bg-gradient-to-r from-gray-100 to-navy-dark border-border'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4',
                    mode.id === 'light' ? 'text-gray-600' : 'text-text-secondary'
                  )} />
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  isActive ? 'text-accent' : 'text-text-secondary'
                )}>
                  {mode.label}
                </span>
              </button>
            );
          })}
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
