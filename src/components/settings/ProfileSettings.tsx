'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Camera, Save, Loader2 } from 'lucide-react';

export default function ProfileSettings() {
  const { user } = useAuth();
  // Track local edits separately. When null, we display the value from
  // the user context.
  const [localDisplayName, setLocalDisplayName] = useState<string | null>(null);

  // Use local edit if user has typed, otherwise derive from user context
  const displayName = localDisplayName ?? user?.display_name ?? '';
  const email = user?.email ?? '';
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Placeholder: would update Supabase profile
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
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Profile Information</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/30 flex items-center justify-center">
              <span className="text-accent text-lg font-bold">{initials}</span>
            </div>
            <button
              type="button"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-hover transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-text-secondary" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{displayName || 'Your Name'}</p>
            <p className="text-xs text-text-muted">Click the camera to update your photo</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setLocalDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-muted cursor-not-allowed"
            />
            <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
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
