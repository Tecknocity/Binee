'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Save, Loader2, AlertTriangle, Mail, Check } from 'lucide-react';

export default function AccountSettings() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || email === user?.email) return;
    setEmailSaving(true);
    // Placeholder: would call supabase.auth.updateUser({ email })
    await new Promise((r) => setTimeout(r, 600));
    setEmailSaving(false);
    setEmailSaved(true);
    setEmailEditing(false);
    setTimeout(() => setEmailSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Email */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Account</h2>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Email address
          </label>
          {emailEditing ? (
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={emailSaving || email === user?.email}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {emailSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Update email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailEditing(false);
                    setEmail(user?.email || '');
                  }}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-text-muted">
                A confirmation email will be sent to your new address.
              </p>
            </form>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={email}
                  disabled
                  className="flex-1 px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-muted cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setEmailEditing(true)}
                  className="px-4 py-2.5 text-sm font-medium text-accent hover:text-accent-hover border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
                >
                  Change
                </button>
              </div>
              {emailSaved && (
                <p className="text-xs text-success mt-1.5">
                  Confirmation email sent! Check your inbox to verify the new address.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Change password */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-navy-base border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-error mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              'Password updated!'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Update password
              </>
            )}
          </button>
        </form>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Danger zone */}
      <div>
        <h2 className="text-lg font-medium text-error mb-2">Danger Zone</h2>
        <p className="text-sm text-text-secondary mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>

        {showDeleteConfirm ? (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  Are you sure you want to delete your account?
                </p>
                <p className="text-xs text-text-muted mb-3">
                  This will permanently delete your account and all associated data.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-error rounded-lg hover:bg-error/80 transition-colors">
                    Delete my account
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-error border border-error/30 rounded-lg hover:bg-error/10 transition-colors"
          >
            Delete account
          </button>
        )}
      </div>
    </div>
  );
}
