import React, { useState, useMemo } from 'react';
import { Check, X, Monitor, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains special character', test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

const ACTIVE_SESSIONS = [
  {
    id: '1',
    device: 'Chrome on macOS',
    icon: Monitor,
    location: 'San Francisco, CA',
    lastActive: 'Now (current session)',
    isCurrent: true,
  },
  {
    id: '2',
    device: 'Safari on iPhone 15',
    icon: Smartphone,
    location: 'San Francisco, CA',
    lastActive: '2 hours ago',
    isCurrent: false,
  },
  {
    id: '3',
    device: 'Firefox on Windows',
    icon: Monitor,
    location: 'New York, NY',
    lastActive: '3 days ago',
    isCurrent: false,
  },
];

const SecuritySection: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const requirementStatus = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: req.test(newPassword),
    }));
  }, [newPassword]);

  const allRequirementsMet = requirementStatus.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (!allRequirementsMet) {
      toast.error('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      toast.error('New passwords do not match.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password changed successfully!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage your password and account security settings
        </p>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Change Password</h3>
        <div className="space-y-5">
          {/* Current Password */}
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-foreground mb-1.5">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Password Requirements Checklist */}
          {newPassword.length > 0 && (
            <div className="space-y-2 p-4 bg-background rounded-lg border border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Password Requirements
              </p>
              {requirementStatus.map((req) => (
                <div key={req.label} className="flex items-center gap-2">
                  {req.met ? (
                    <Check size={14} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <X size={14} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      req.met ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive mt-1.5">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-emerald-500 mt-1.5 flex items-center gap-1">
                <Check size={12} />
                Passwords match
              </p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={!allRequirementsMet || !passwordsMatch || !currentPassword}
            className="px-6 py-2.5 gradient-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Two-Factor Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-yellow-500/15 border border-yellow-500/30 rounded-md text-yellow-500 text-xs font-medium">
              Coming Soon
            </span>
            <Switch disabled />
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Active Sessions</h3>
        <div className="space-y-4">
          {ACTIVE_SESSIONS.map((session) => {
            const Icon = session.icon;
            return (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-background rounded-lg border border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {session.device}
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-500 text-xs font-medium rounded">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.location} &middot; {session.lastActive}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SecuritySection;
