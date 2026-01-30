import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import { theme } from '../styles/theme';
import {
  User,
  Lock,
  Bell,
  Palette,
  Shield,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

type SettingsSection = 'profile' | 'security' | 'notifications' | 'appearance' | 'privacy';

interface NotificationSettings {
  emailWeeklyDigest: boolean;
  emailAlerts: boolean;
  emailProductUpdates: boolean;
  inAppTaskReminders: boolean;
  inAppSyncAlerts: boolean;
  inAppGoalUpdates: boolean;
}

interface AppearanceSettings {
  theme: 'dark' | 'light';
  density: 'comfortable' | 'compact';
  defaultTab: string;
}

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [isEditing, setIsEditing] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john@company.com',
    timezone: 'America/New_York',
    avatar: null as string | null,
  });

  // Security state
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailWeeklyDigest: true,
    emailAlerts: true,
    emailProductUpdates: false,
    inAppTaskReminders: true,
    inAppSyncAlerts: true,
    inAppGoalUpdates: true,
  });

  // Appearance settings
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'dark',
    density: 'comfortable',
    defaultTab: 'overview',
  });

  const sections = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Password & Security', icon: Lock },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'privacy' as const, label: 'Data & Privacy', icon: Shield },
  ];

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  ];

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'intelligence', label: 'Intelligence' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'operations', label: 'Operations' },
    { value: 'goals', label: 'Goals' },
    { value: 'issues', label: 'Issues' },
    { value: 'suggestions', label: 'Suggestions' },
  ];

  const handleSaveProfile = () => {
    setIsEditing(false);
    alert('Profile saved successfully!');
  };

  const handleChangePassword = () => {
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match!');
      return;
    }
    if (passwords.new.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    setPasswords({ current: '', new: '', confirm: '' });
    alert('Password changed successfully!');
  };

  const handleExportData = () => {
    alert('Your data export has been initiated. You will receive an email when it is ready.');
  };

  const handleDeleteAccount = () => {
    alert('Account deletion requested. This action cannot be undone.');
  };

  const cardStyle: React.CSSProperties = {
    background: theme.colors.cardBgSolid,
    borderRadius: theme.borderRadius['2xl'],
    border: theme.colors.cardBorder,
    padding: theme.spacing['2xl'],
    marginBottom: theme.spacing.xl,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: theme.colors.dark,
    border: `1px solid ${theme.colors.mutedBorder}`,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    background: theme.colors.gradient,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    border: `1px solid ${theme.colors.mutedBorder}`,
    color: theme.colors.textSecondary,
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: theme.colors.dangerLight,
    border: `1px solid ${theme.colors.dangerBorder}`,
    color: theme.colors.danger,
  };

  const renderProfileSection = () => (
    <div>
      <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xl }}>
        Profile Settings
      </h2>

      <div style={cardStyle}>
        {/* Avatar Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xl, marginBottom: theme.spacing['2xl'] }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <User size={32} color={theme.colors.text} />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '28px',
                height: '28px',
                borderRadius: theme.borderRadius.full,
                background: theme.colors.darkSolid,
                border: `2px solid ${theme.colors.primary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={14} color={theme.colors.primary} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
              Profile Photo
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
              Click to upload a new photo
            </div>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <label style={labelStyle}>Full Name</label>
          <Input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="bg-slate-800/80 border-slate-600 text-white"
            disabled={!isEditing}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <label style={labelStyle}>Email Address</label>
          <Input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="bg-slate-800/80 border-slate-600 text-white"
            disabled={!isEditing}
          />
        </div>

        {/* Timezone */}
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <label style={labelStyle}>Timezone</label>
          <Select
            value={profile.timezone}
            onValueChange={(value) => setProfile({ ...profile, timezone: value })}
            disabled={!isEditing}
          >
            <SelectTrigger className="bg-slate-800/80 border-slate-600 text-white">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-white hover:bg-slate-700">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          {isEditing ? (
            <>
              <button style={buttonStyle} onClick={handleSaveProfile}>
                Save Changes
              </button>
              <button style={secondaryButtonStyle} onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button style={buttonStyle} onClick={() => setIsEditing(true)}>
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderSecuritySection = () => (
    <div>
      <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xl }}>
        Password & Security
      </h2>

      {/* Change Password */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xl }}>
          Change Password
        </h3>

        <div style={{ marginBottom: theme.spacing.xl }}>
          <label style={labelStyle}>Current Password</label>
          <Input
            type="password"
            value={passwords.current}
            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            className="bg-slate-800/80 border-slate-600 text-white"
            placeholder="Enter current password"
          />
        </div>

        <div style={{ marginBottom: theme.spacing.xl }}>
          <label style={labelStyle}>New Password</label>
          <Input
            type="password"
            value={passwords.new}
            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
            className="bg-slate-800/80 border-slate-600 text-white"
            placeholder="Enter new password"
          />
        </div>

        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <label style={labelStyle}>Confirm New Password</label>
          <Input
            type="password"
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            className="bg-slate-800/80 border-slate-600 text-white"
            placeholder="Confirm new password"
          />
        </div>

        <button style={buttonStyle} onClick={handleChangePassword}>
          Change Password
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs }}>
              Two-Factor Authentication
            </h3>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
              Add an extra layer of security to your account
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <span
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                background: theme.colors.warningLight,
                border: `1px solid ${theme.colors.warningBorder}`,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.warning,
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.medium,
              }}
            >
              Coming Soon
            </span>
            <Switch disabled />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div>
      <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xl }}>
        Notification Preferences
      </h2>

      {/* Email Notifications */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xl }}>
          Email Notifications
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Weekly Digest
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Receive a weekly summary of your dashboard activity
              </div>
            </div>
            <Switch
              checked={notifications.emailWeeklyDigest}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailWeeklyDigest: checked })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Alerts
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Get notified about important issues and updates
              </div>
            </div>
            <Switch
              checked={notifications.emailAlerts}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Product Updates
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Learn about new features and improvements
              </div>
            </div>
            <Switch
              checked={notifications.emailProductUpdates}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailProductUpdates: checked })}
            />
          </div>
        </div>
      </div>

      {/* In-App Notifications */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xl }}>
          In-App Notifications
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Task Reminders
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Get reminded about upcoming and overdue tasks
              </div>
            </div>
            <Switch
              checked={notifications.inAppTaskReminders}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppTaskReminders: checked })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Sync Alerts
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Be notified when integrations sync or encounter issues
              </div>
            </div>
            <Switch
              checked={notifications.inAppSyncAlerts}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppSyncAlerts: checked })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                Goal Updates
              </div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                Track progress towards your goals
              </div>
            </div>
            <Switch
              checked={notifications.inAppGoalUpdates}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppGoalUpdates: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div>
      <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xl }}>
        Appearance
      </h2>

      <div style={cardStyle}>
        {/* Theme Toggle */}
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <label style={labelStyle}>Theme</label>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <button
              onClick={() => setAppearance({ ...appearance, theme: 'dark' })}
              style={{
                flex: 1,
                padding: theme.spacing.lg,
                background: appearance.theme === 'dark' ? theme.colors.primaryLight : 'transparent',
                border: `1px solid ${appearance.theme === 'dark' ? theme.colors.primary : theme.colors.mutedBorder}`,
                borderRadius: theme.borderRadius.lg,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: `all ${theme.transitions.normal}`,
              }}
            >
              <div style={{ fontWeight: theme.fontWeight.semibold }}>Dark</div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>Default theme</div>
            </button>
            <button
              onClick={() => setAppearance({ ...appearance, theme: 'light' })}
              style={{
                flex: 1,
                padding: theme.spacing.lg,
                background: appearance.theme === 'light' ? theme.colors.primaryLight : 'transparent',
                border: `1px solid ${appearance.theme === 'light' ? theme.colors.primary : theme.colors.mutedBorder}`,
                borderRadius: theme.borderRadius.lg,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: `all ${theme.transitions.normal}`,
              }}
            >
              <div style={{ fontWeight: theme.fontWeight.semibold }}>Light</div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>Coming soon</div>
            </button>
          </div>
        </div>

        {/* Density */}
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <label style={labelStyle}>Dashboard Density</label>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <button
              onClick={() => setAppearance({ ...appearance, density: 'comfortable' })}
              style={{
                flex: 1,
                padding: theme.spacing.lg,
                background: appearance.density === 'comfortable' ? theme.colors.primaryLight : 'transparent',
                border: `1px solid ${appearance.density === 'comfortable' ? theme.colors.primary : theme.colors.mutedBorder}`,
                borderRadius: theme.borderRadius.lg,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: `all ${theme.transitions.normal}`,
              }}
            >
              <div style={{ fontWeight: theme.fontWeight.semibold }}>Comfortable</div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>More spacing</div>
            </button>
            <button
              onClick={() => setAppearance({ ...appearance, density: 'compact' })}
              style={{
                flex: 1,
                padding: theme.spacing.lg,
                background: appearance.density === 'compact' ? theme.colors.primaryLight : 'transparent',
                border: `1px solid ${appearance.density === 'compact' ? theme.colors.primary : theme.colors.mutedBorder}`,
                borderRadius: theme.borderRadius.lg,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: `all ${theme.transitions.normal}`,
              }}
            >
              <div style={{ fontWeight: theme.fontWeight.semibold }}>Compact</div>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>Less spacing</div>
            </button>
          </div>
        </div>

        {/* Default Landing Tab */}
        <div>
          <label style={labelStyle}>Default Landing Tab</label>
          <Select
            value={appearance.defaultTab}
            onValueChange={(value) => setAppearance({ ...appearance, defaultTab: value })}
          >
            <SelectTrigger className="bg-slate-800/80 border-slate-600 text-white">
              <SelectValue placeholder="Select default tab" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {tabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value} className="text-white hover:bg-slate-700">
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div>
      <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xl }}>
        Data & Privacy
      </h2>

      {/* Export Data */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs }}>
              Export My Data
            </h3>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
              Download a copy of all your data in JSON format
            </p>
          </div>
          <button style={secondaryButtonStyle} onClick={handleExportData}>
            Export Data
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div style={{ ...cardStyle, borderColor: theme.colors.dangerBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3
              style={{
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
                marginBottom: theme.spacing.xs,
                color: theme.colors.danger,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <AlertTriangle size={18} />
              Delete Account
            </h3>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button style={dangerButtonStyle}>Delete Account</button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  This action cannot be undone. This will permanently delete your account and remove all
                  your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDeleteAccount}
                >
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'security':
        return renderSecuritySection();
      case 'notifications':
        return renderNotificationsSection();
      case 'appearance':
        return renderAppearanceSection();
      case 'privacy':
        return renderPrivacySection();
      default:
        return null;
    }
  };

  return (
    <PageLayout title="Settings" subtitle="Manage your account preferences">
      <div style={{ display: 'flex', gap: theme.spacing['2xl'] }}>
        {/* Sidebar */}
        <nav
          style={{
            width: '260px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: theme.colors.cardBgSolid,
              borderRadius: theme.borderRadius['2xl'],
              border: theme.colors.cardBorder,
              padding: theme.spacing.lg,
              position: 'sticky',
              top: theme.spacing['2xl'],
            }}
          >
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                    background: isActive ? theme.colors.primaryLight : 'transparent',
                    border: 'none',
                    borderRadius: theme.borderRadius.lg,
                    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                    fontSize: theme.fontSize.base,
                    fontWeight: isActive ? theme.fontWeight.semibold : theme.fontWeight.medium,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: `all ${theme.transitions.normal}`,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <Icon size={18} />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ flex: 1, maxWidth: '800px' }}>{renderContent()}</div>
      </div>
    </PageLayout>
  );
};

export default Settings;
