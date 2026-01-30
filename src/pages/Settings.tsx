import React, { useRef } from 'react';
import { PageLayout } from '../components/Layout';
import { useTheme } from 'next-themes';
import { useSettings } from '../hooks/useSettings';
import {
  User,
  Lock,
  Bell,
  Palette,
  Shield,
  Camera,
  AlertTriangle,
  Building2,
  Globe,
  Mail,
  Sun,
  Moon,
  Monitor,
  Check,
  Loader2,
} from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

type SettingsSection = 'profile' | 'brand' | 'security' | 'notifications' | 'appearance' | 'privacy';

const Settings: React.FC = () => {
  const { theme: currentTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = React.useState<SettingsSection>('profile');
  const { settings, isSaving, updateProfile, updateBrand, updateNotifications, updateAppearance } = useSettings();

  // File upload refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Password state (not auto-saved)
  const [passwords, setPasswords] = React.useState({
    current: '',
    new: '',
    confirm: '',
  });

  const sections = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'brand' as const, label: 'Brand', icon: Building2 },
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

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
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

  const SaveIndicator = () => (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 shadow-lg animate-fade-in">
      {isSaving ? (
        <>
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Saving...</span>
        </>
      ) : (
        <>
          <Check size={16} className="text-success" />
          <span className="text-sm text-muted-foreground">Saved</span>
        </>
      )}
    </div>
  );

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Profile Settings</h2>
        <p className="text-muted-foreground">Manage your personal information</p>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="pt-6">
          {/* Avatar Upload */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div 
                className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {settings.profile.avatar ? (
                  <img src={settings.profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-primary-foreground" />
                )}
              </div>
              <button 
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Camera size={14} className="text-primary" />
              </button>
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">Profile Photo</div>
              <div className="text-sm text-muted-foreground">Click to upload a new photo</div>
            </div>
          </div>

          {/* Form Fields - Auto-save on change */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={settings.profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={settings.profile.email}
                onChange={(e) => updateProfile({ email: e.target.value })}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={settings.profile.timezone}
                onValueChange={(value) => updateProfile({ timezone: value })}
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBrandSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Brand Settings</h2>
        <p className="text-muted-foreground">Customize your brand identity</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 size={20} className="text-primary" />
            Brand Identity
          </CardTitle>
          <CardDescription>Configure your brand name and messaging</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand Name</Label>
            <Input
              id="brandName"
              type="text"
              value={settings.brand.name}
              onChange={(e) => updateBrand({ name: e.target.value })}
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              type="text"
              value={settings.brand.tagline}
              onChange={(e) => updateBrand({ tagline: e.target.value })}
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe size={14} />
              Website
            </Label>
            <Input
              id="website"
              type="url"
              value={settings.brand.website}
              onChange={(e) => updateBrand({ website: e.target.value })}
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportEmail" className="flex items-center gap-2">
              <Mail size={14} />
              Support Email
            </Label>
            <Input
              id="supportEmail"
              type="email"
              value={settings.brand.supportEmail}
              onChange={(e) => updateBrand({ supportEmail: e.target.value })}
              className="bg-muted/50 border-border"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Logo Upload</CardTitle>
          <CardDescription>Upload your brand logo</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                alert(`Logo "${file.name}" selected! In production, this would be uploaded to storage.`);
              }
            }}
            className="hidden"
          />
          <div 
            onClick={() => logoInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Camera size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Drag and drop your logo here, or click to browse
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Recommended: 512x512px, PNG or SVG
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Password & Security</h2>
        <p className="text-muted-foreground">Manage your account security</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              placeholder="Enter current password"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              placeholder="Enter new password"
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              placeholder="Confirm new password"
              className="bg-muted/50 border-border"
            />
          </div>

          <Button onClick={handleChangePassword}>Change Password</Button>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h3>
              <p className="text-muted-foreground text-sm">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-warning/15 border border-warning/30 rounded-md text-warning text-sm font-medium">
                Coming Soon
              </span>
              <Switch disabled />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Notification Preferences</h2>
        <p className="text-muted-foreground">Control how you receive notifications</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Weekly Digest</div>
              <div className="text-sm text-muted-foreground">Receive a weekly summary of your dashboard activity</div>
            </div>
            <Switch
              checked={settings.notifications.emailWeeklyDigest}
              onCheckedChange={(checked) => updateNotifications({ emailWeeklyDigest: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Alerts</div>
              <div className="text-sm text-muted-foreground">Get notified about important issues and updates</div>
            </div>
            <Switch
              checked={settings.notifications.emailAlerts}
              onCheckedChange={(checked) => updateNotifications({ emailAlerts: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Product Updates</div>
              <div className="text-sm text-muted-foreground">Learn about new features and improvements</div>
            </div>
            <Switch
              checked={settings.notifications.emailProductUpdates}
              onCheckedChange={(checked) => updateNotifications({ emailProductUpdates: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">In-App Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Task Reminders</div>
              <div className="text-sm text-muted-foreground">Get reminded about upcoming and overdue tasks</div>
            </div>
            <Switch
              checked={settings.notifications.inAppTaskReminders}
              onCheckedChange={(checked) => updateNotifications({ inAppTaskReminders: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Sync Alerts</div>
              <div className="text-sm text-muted-foreground">Be notified when integrations sync or encounter issues</div>
            </div>
            <Switch
              checked={settings.notifications.inAppSyncAlerts}
              onCheckedChange={(checked) => updateNotifications({ inAppSyncAlerts: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Goal Updates</div>
              <div className="text-sm text-muted-foreground">Track progress towards your goals</div>
            </div>
            <Switch
              checked={settings.notifications.inAppGoalUpdates}
              onCheckedChange={(checked) => updateNotifications({ inAppGoalUpdates: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Appearance</h2>
        <p className="text-muted-foreground">Customize how the dashboard looks</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'light'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-3">
                <Sun size={24} className="text-warning" />
              </div>
              <div className="font-semibold text-foreground">Light</div>
              <div className="text-xs text-muted-foreground">Bright and clean</div>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'dark'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                <Moon size={24} className="text-muted-foreground" />
              </div>
              <div className="font-semibold text-foreground">Dark</div>
              <div className="text-xs text-muted-foreground">Easy on the eyes</div>
            </button>

            <button
              onClick={() => setTheme('system')}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentTheme === 'system'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center mx-auto mb-3">
                <Monitor size={24} className="text-primary-foreground" />
              </div>
              <div className="font-semibold text-foreground">System</div>
              <div className="text-xs text-muted-foreground">Match device</div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Dashboard Density</CardTitle>
          <CardDescription>Choose your preferred content spacing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => updateAppearance({ density: 'comfortable' })}
              className={`p-4 rounded-xl border-2 transition-all ${
                settings.appearance.density === 'comfortable'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold text-foreground">Comfortable</div>
              <div className="text-sm text-muted-foreground">More spacing</div>
            </button>

            <button
              onClick={() => updateAppearance({ density: 'compact' })}
              className={`p-4 rounded-xl border-2 transition-all ${
                settings.appearance.density === 'compact'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold text-foreground">Compact</div>
              <div className="text-sm text-muted-foreground">Less spacing</div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Default Landing Tab</CardTitle>
          <CardDescription>Choose which tab opens first</CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={settings.appearance.defaultTab} 
            onValueChange={(value) => updateAppearance({ defaultTab: value })}
          >
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Select default tab" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Data & Privacy</h2>
        <p className="text-muted-foreground">Manage your data and privacy settings</p>
      </div>

      <Card className="glass border-border/50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Export My Data</h3>
              <p className="text-muted-foreground text-sm">Download a copy of all your data in JSON format</p>
            </div>
            <Button variant="outline" onClick={handleExportData}>Export Data</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-destructive/30">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle size={18} />
                Delete Account
              </h3>
              <p className="text-muted-foreground text-sm">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove all
                    your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteAccount}
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'brand':
        return renderBrandSection();
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
      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-64 flex-shrink-0">
          <Card className="glass border-border/50 sticky top-8">
            <CardContent className="p-4">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all mb-1 ${
                      isActive
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <Icon size={18} />
                    {section.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </nav>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl animate-fade-in">
          {renderContent()}
        </div>
      </div>
      
      <SaveIndicator />
    </PageLayout>
  );
};

export default Settings;
