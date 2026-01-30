import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import { useTheme } from 'next-themes';
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

interface NotificationSettings {
  emailWeeklyDigest: boolean;
  emailAlerts: boolean;
  emailProductUpdates: boolean;
  inAppTaskReminders: boolean;
  inAppSyncAlerts: boolean;
  inAppGoalUpdates: boolean;
}

interface BrandSettings {
  name: string;
  tagline: string;
  website: string;
  supportEmail: string;
  primaryColor: string;
  secondaryColor: string;
}

const Settings: React.FC = () => {
  const { theme: currentTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isBrandEditing, setIsBrandEditing] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john@company.com',
    timezone: 'America/New_York',
    avatar: null as string | null,
  });

  // Brand state
  const [brand, setBrand] = useState<BrandSettings>({
    name: 'Binee',
    tagline: 'AI-powered business intelligence',
    website: 'https://binee.lovable.app',
    supportEmail: 'support@binee.app',
    primaryColor: '258 90% 66%',
    secondaryColor: '24 95% 53%',
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
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [defaultTab, setDefaultTab] = useState('overview');

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

  const handleSaveProfile = () => {
    setIsEditing(false);
    alert('Profile saved successfully!');
  };

  const handleSaveBrand = () => {
    setIsBrandEditing(false);
    alert('Brand settings saved successfully!');
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
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center">
                <User size={32} className="text-primary-foreground" />
              </div>
              <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center hover:bg-muted transition-colors">
                <Camera size={14} className="text-primary" />
              </button>
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">Profile Photo</div>
              <div className="text-sm text-muted-foreground">Click to upload a new photo</div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                disabled={!isEditing}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                disabled={!isEditing}
                className="bg-muted/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={profile.timezone}
                onValueChange={(value) => setProfile({ ...profile, timezone: value })}
                disabled={!isEditing}
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

            <div className="flex gap-3 pt-4">
              {isEditing ? (
                <>
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
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
              value={brand.name}
              onChange={(e) => setBrand({ ...brand, name: e.target.value })}
              disabled={!isBrandEditing}
              className="bg-muted/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              type="text"
              value={brand.tagline}
              onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
              disabled={!isBrandEditing}
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
              value={brand.website}
              onChange={(e) => setBrand({ ...brand, website: e.target.value })}
              disabled={!isBrandEditing}
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
              value={brand.supportEmail}
              onChange={(e) => setBrand({ ...brand, supportEmail: e.target.value })}
              disabled={!isBrandEditing}
              className="bg-muted/50 border-border"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette size={20} className="text-primary" />
            Brand Colors
          </CardTitle>
          <CardDescription>Define your brand's color palette (HSL format)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-border"
                  style={{ backgroundColor: `hsl(${brand.primaryColor})` }}
                />
                <Input
                  id="primaryColor"
                  type="text"
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  disabled={!isBrandEditing}
                  placeholder="258 90% 66%"
                  className="bg-muted/50 border-border flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Accent Color</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-border"
                  style={{ backgroundColor: `hsl(${brand.secondaryColor})` }}
                />
                <Input
                  id="secondaryColor"
                  type="text"
                  value={brand.secondaryColor}
                  onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                  disabled={!isBrandEditing}
                  placeholder="24 95% 53%"
                  className="bg-muted/50 border-border flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {isBrandEditing ? (
              <>
                <Button onClick={handleSaveBrand}>Save Brand Settings</Button>
                <Button variant="outline" onClick={() => setIsBrandEditing(false)}>Cancel</Button>
              </>
            ) : (
              <Button onClick={() => setIsBrandEditing(true)}>Edit Brand</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Logo Upload</CardTitle>
          <CardDescription>Upload your brand logo (coming soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
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
              checked={notifications.emailWeeklyDigest}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailWeeklyDigest: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Alerts</div>
              <div className="text-sm text-muted-foreground">Get notified about important issues and updates</div>
            </div>
            <Switch
              checked={notifications.emailAlerts}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Product Updates</div>
              <div className="text-sm text-muted-foreground">Learn about new features and improvements</div>
            </div>
            <Switch
              checked={notifications.emailProductUpdates}
              onCheckedChange={(checked) => setNotifications({ ...notifications, emailProductUpdates: checked })}
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
              checked={notifications.inAppTaskReminders}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppTaskReminders: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Sync Alerts</div>
              <div className="text-sm text-muted-foreground">Be notified when integrations sync or encounter issues</div>
            </div>
            <Switch
              checked={notifications.inAppSyncAlerts}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppSyncAlerts: checked })}
            />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">Goal Updates</div>
              <div className="text-sm text-muted-foreground">Track progress towards your goals</div>
            </div>
            <Switch
              checked={notifications.inAppGoalUpdates}
              onCheckedChange={(checked) => setNotifications({ ...notifications, inAppGoalUpdates: checked })}
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
                <Monitor size={24} className="text-foreground" />
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
              onClick={() => setDensity('comfortable')}
              className={`p-4 rounded-xl border-2 transition-all ${
                density === 'comfortable'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold text-foreground">Comfortable</div>
              <div className="text-sm text-muted-foreground">More spacing</div>
            </button>

            <button
              onClick={() => setDensity('compact')}
              className={`p-4 rounded-xl border-2 transition-all ${
                density === 'compact'
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
          <Select value={defaultTab} onValueChange={setDefaultTab}>
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
    </PageLayout>
  );
};

export default Settings;
