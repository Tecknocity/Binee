'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/auth/AuthProvider';
import { Monitor, Moon, Sun, Save, Loader2, Camera, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type ColorMode = 'light' | 'system' | 'dark';

const colorModes: { id: ColorMode; label: string; icon: typeof Sun; description: string }[] = [
  { id: 'light', label: 'Light', icon: Sun, description: 'Always use light theme' },
  { id: 'system', label: 'Auto', icon: Monitor, description: 'Match system setting' },
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark theme' },
];

const ROTATING_PLACEHOLDERS = [
  'I prefer concise, bullet-point summaries over long paragraphs',
  'Always prioritize tasks by deadline, then by priority level',
  'I like data-driven recommendations with specific numbers',
  'When analyzing tasks, group them by team member first',
  'I prefer dashboards that show trends over the last 30 days',
  'Keep suggestions actionable -tell me exactly what to do next',
  'I work best with morning priorities and end-of-day reviews',
  'Use simple language, avoid jargon unless it\'s industry-specific',
  'I like to see both the big picture and the details',
  'When in doubt, ask me clarifying questions before proceeding',
];

const TIMEZONES = [
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time' },
  { value: 'America/Halifax', label: '(GMT-04:00) Atlantic Time' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
  { value: 'Atlantic/South_Georgia', label: '(GMT-02:00) Mid-Atlantic' },
  { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores' },
  { value: 'Europe/London', label: '(GMT+00:00) London' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris, Berlin' },
  { value: 'Europe/Helsinki', label: '(GMT+02:00) Helsinki, Cairo' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) Mumbai, New Delhi' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Shanghai, Singapore' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney' },
  { value: 'Pacific/Noumea', label: '(GMT+11:00) Noumea' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland' },
];

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.some((t) => t.value === tz)) return tz;
  } catch {
    // ignore
  }
  return 'America/New_York';
}

const emptySubscribe = () => () => {};

export default function GeneralSettings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [preferredName, setPreferredName] = useState(user?.display_name?.split(' ')[0] || '');
  const [workRole, setWorkRole] = useState('Founder/Owner');
  const [personalPreferences, setPersonalPreferences] = useState('');
  const [timezone, setTimezone] = useState(detectTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotating placeholder for personal preferences
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused || personalPreferences) return;
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [isFocused, personalPreferences]);

  // Auto-fill preferred name from first name when display name changes
  const handleDisplayNameChange = useCallback((value: string) => {
    setDisplayName(value);
    const first = value.split(' ')[0] || '';
    setPreferredName(first);
  }, []);

  const colorMode = (mounted ? theme : 'dark') as ColorMode;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await updateUser({
      display_name: displayName,
      avatar_url: avatarPreview,
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Profile</h2>
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-2">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/30"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/30 flex items-center justify-center">
                  <span className="text-accent text-lg font-bold">{initials}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-text-secondary" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{displayName || 'Your Name'}</p>
              <p className="text-xs text-text-muted">Click the camera to update your photo</p>
            </div>
          </div>

          {/* Full name + preferred name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                What should Binee call you?
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Your preferred name"
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
              <option value="Founder/Owner">Founder/Owner</option>
              <option value="CEO">CEO</option>
              <option value="CTO">CTO</option>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Finance">Finance</option>
              <option value="HR">HR</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Consultant">Consultant</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Personal preferences with rotating placeholder */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              What personal preferences should Binee consider in responses?
            </label>
            <p className="text-xs text-text-muted mb-2">
              Your preferences will apply to all conversations.
            </p>
            <div className="relative">
              <textarea
                value={personalPreferences}
                onChange={(e) => setPersonalPreferences(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                rows={3}
                className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
              />
              {!personalPreferences && !isFocused && (
                <div className="absolute top-0 left-0 right-0 px-3 py-2.5 pointer-events-none">
                  <span
                    className={cn(
                      'text-sm text-text-muted transition-opacity duration-300',
                      placeholderVisible ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {ROTATING_PLACEHOLDERS[placeholderIndex]}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Timezone
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Used for daily notifications and digest scheduling.
            </p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Appearance</h2>
        <p className="text-sm text-text-secondary mb-3">Color mode</p>
        <div className="grid grid-cols-3 gap-4">
          {colorModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = colorMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                  isActive
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface hover:border-border-light'
                )}
              >
                <div
                  className={cn(
                    'w-16 h-10 rounded-lg border flex items-center justify-center',
                    mode.id === 'light'
                      ? 'bg-[#F5F3EF] border-[#E3E0DA]'
                      : mode.id === 'dark'
                        ? 'bg-navy-dark border-border'
                        : 'bg-gradient-to-r from-[#F5F3EF] to-navy-dark border-border'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4',
                    mode.id === 'light' ? 'text-[#4A4A5C]' : 'text-text-secondary'
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
