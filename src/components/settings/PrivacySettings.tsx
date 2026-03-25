'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Save, Loader2, Download, Trash2, ShieldCheck, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getActionPreferences,
  resetActionPreferences,
  type ActionPreference,
} from '@/lib/ai/action-preferences';

export default function PrivacySettings() {
  const { profile, loading: profileLoading, error: profileError, saveProfile } = useUserProfile();
  const [allowTraining, setAllowTraining] = useState(false);
  const [chatHistory, setChatHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const profileHydrated = useRef(false);

  // Action preferences (B-055)
  const [actionPrefs, setActionPrefs] = useState<Record<string, ActionPreference>>(getActionPreferences);

  // Hydrate form from user_profiles once loaded
  useEffect(() => {
    if (profileLoading || profileHydrated.current) return;
    profileHydrated.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from async profile data
    setAllowTraining(profile.allow_training);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from async profile data
    setChatHistory(profile.chat_history_enabled);
  }, [profileLoading, profile]);

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

      {/* Action Preferences (B-055) */}
      <ActionPreferencesSection
        preferences={actionPrefs}
        onReset={(operationType) => {
          resetActionPreferences(operationType);
          setActionPrefs(getActionPreferences());
        }}
        onResetAll={() => {
          resetActionPreferences();
          setActionPrefs({});
        }}
      />

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

// ---------------------------------------------------------------------------
// Action Preferences Section (B-055)
// ---------------------------------------------------------------------------

const OPERATION_LABELS: Record<string, string> = {
  create_task: 'Create Task',
  update_task: 'Update Task',
  assign_task: 'Assign Task',
  move_task: 'Move Task',
  delete_task: 'Delete Task',
  create_dashboard_widget: 'Create Widget',
  update_dashboard_widget: 'Update Widget',
  write_operation: 'Write Operation',
};

function formatOperationType(toolName: string): string {
  return OPERATION_LABELS[toolName] ?? toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ActionPreferencesSection({
  preferences,
  onReset,
  onResetAll,
}: {
  preferences: Record<string, ActionPreference>;
  onReset: (operationType: string) => void;
  onResetAll: () => void;
}) {
  const alwaysAllowEntries = Object.entries(preferences).filter(
    ([, pref]) => pref === 'always_allow',
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-text-primary">Action Confirmations</h2>
          <p className="text-xs text-text-muted mt-1">
            Operations you&apos;ve set to &quot;Always Allow&quot; will execute without asking for confirmation.
          </p>
        </div>
        {alwaysAllowEntries.length > 0 && (
          <button
            type="button"
            onClick={onResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset all
          </button>
        )}
      </div>

      {alwaysAllowEntries.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl">
          <ShieldCheck className="w-5 h-5 text-text-muted shrink-0" />
          <p className="text-sm text-text-muted">
            No operations are set to &quot;Always Allow&quot;. All write operations will ask for confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alwaysAllowEntries.map(([operationType]) => (
            <div
              key={operationType}
              className="flex items-center justify-between gap-4 p-4 bg-surface border border-border rounded-xl"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {formatOperationType(operationType)}
                  </p>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{operationType}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onReset(operationType)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-error bg-surface border border-border rounded-lg hover:border-error/30 hover:bg-error/5 transition-colors"
                title={`Reset "${formatOperationType(operationType)}" to always ask`}
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
