'use client';

import { useState, useEffect } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Save, Loader2, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PrivacySettings() {
  const { profile, loading: profileLoading, error: profileError, saveProfile } = useUserProfile();
  const [allowTraining, setAllowTraining] = useState(false);
  const [chatHistory, setChatHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Hydrate form from user_profiles
  useEffect(() => {
    if (profileLoading || profileLoaded) return;
    setAllowTraining(profile.allow_training);
    setChatHistory(profile.chat_history_enabled);
    setProfileLoaded(true);
  }, [profileLoading, profileLoaded, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const { error } = await saveProfile({
      allow_training: allowTraining,
      chat_history_enabled: chatHistory,
    });
    setSaving(false);
    if (error) {
      setSaveError(error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Data usage */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Privacy</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-6 p-4 bg-surface border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Improve Binee for everyone
              </p>
              <p className="text-xs text-text-muted mt-1">
                Allow us to use your conversations to improve our AI models. Your data is
                anonymized and never shared with third parties.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowTraining(!allowTraining)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors shrink-0',
                allowTraining ? 'bg-accent' : 'bg-surface border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-[var(--toggle-knob)] shadow-sm transition-transform',
                  allowTraining ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-6 p-4 bg-surface border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Chat history
              </p>
              <p className="text-xs text-text-muted mt-1">
                Save your chat history so you can access previous conversations. When disabled,
                new chats won&apos;t be saved after 30 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChatHistory(!chatHistory)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors shrink-0',
                chatHistory ? 'bg-accent' : 'bg-surface border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-[var(--toggle-knob)] shadow-sm transition-transform',
                  chatHistory ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Data management */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Data Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-text-primary bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
          >
            <Download className="w-4 h-4" />
            Export my data
          </button>

          <button
            type="button"
            className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-error bg-error/5 border border-error/20 rounded-xl hover:bg-error/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete all chat history
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {(saveError || profileError) && (
          <p className="text-sm text-error">{saveError || profileError}</p>
        )}
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
