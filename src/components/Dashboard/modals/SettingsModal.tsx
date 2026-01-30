import React, { useState } from 'react';
import { Modal } from './Modal';
import { Settings, Bell, Puzzle, Shield, Palette, Building2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'brand' | 'notifications' | 'integrations' | 'security' | 'appearance';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'brand', label: 'Brand', icon: Building2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'security', label: 'Security', icon: Shield },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme } = useTheme();

  // General settings state
  const [companyName, setCompanyName] = useState('Acme Corporation');
  const [timezone, setTimezone] = useState('UTC-5');
  const [currency, setCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [language, setLanguage] = useState('en');

  // Brand settings state
  const [brandName, setBrandName] = useState('Acme Corp');
  const [tagline, setTagline] = useState('Innovation at Scale');
  const [website, setWebsite] = useState('https://acme.com');
  const [supportEmail, setSupportEmail] = useState('support@acme.com');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');

  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [alertThresholds, setAlertThresholds] = useState(true);
  const [goalReminders, setGoalReminders] = useState(false);
  const [teamUpdates, setTeamUpdates] = useState(true);

  // Security settings state
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [auditLogging, setAuditLogging] = useState(true);

  const inputClass = "w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-2";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="750px">
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-border pr-4">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id 
                    ? "bg-primary/15 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 max-h-[60vh] overflow-y-auto pr-2">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">General Settings</h3>
              
              <div>
                <label className={labelClass}>Company Name</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Timezone</label>
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputClass}
                >
                  <option value="UTC-5">Eastern Time (UTC-5)</option>
                  <option value="UTC-6">Central Time (UTC-6)</option>
                  <option value="UTC-7">Mountain Time (UTC-7)</option>
                  <option value="UTC-8">Pacific Time (UTC-8)</option>
                  <option value="UTC+0">UTC</option>
                  <option value="UTC+1">Central European Time (UTC+1)</option>
                  <option value="UTC+8">China Standard Time (UTC+8)</option>
                  <option value="UTC+9">Japan Standard Time (UTC+9)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Currency</label>
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputClass}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Date Format</label>
                  <select 
                    value={dateFormat} 
                    onChange={(e) => setDateFormat(e.target.value)}
                    className={inputClass}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Language</label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className={inputClass}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'brand' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Brand Information</h3>
              <p className="text-sm text-muted-foreground">Customize your brand identity and public-facing information.</p>
              
              <div className="p-4 border border-dashed border-border rounded-xl bg-secondary/20 flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Building2 size={32} className="text-white" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors">
                  <Upload size={16} />
                  Upload Logo
                </button>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
              </div>

              <div>
                <label className={labelClass}>Brand Name</label>
                <input 
                  type="text" 
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className={inputClass}
                  placeholder="Your brand name"
                />
              </div>

              <div>
                <label className={labelClass}>Tagline</label>
                <input 
                  type="text" 
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className={inputClass}
                  placeholder="Your company tagline"
                />
              </div>

              <div>
                <label className={labelClass}>Website</label>
                <input 
                  type="url" 
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={inputClass}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label className={labelClass}>Support Email</label>
                <input 
                  type="email" 
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className={inputClass}
                  placeholder="support@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Primary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className={cn(inputClass, "flex-1")}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Secondary Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className={cn(inputClass, "flex-1")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
              <p className="text-sm text-muted-foreground">Customize the look and feel of your dashboard.</p>

              <div className="space-y-3">
                <label className={labelClass}>Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      theme === 'light' 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50 bg-secondary/30"
                    )}
                  >
                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Light</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      theme === 'dark' 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50 bg-secondary/30"
                    )}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Dark</span>
                  </button>

                  <button
                    onClick={() => setTheme('system')}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      theme === 'system' 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50 bg-secondary/30"
                    )}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-white to-gray-900 border border-gray-400 flex items-center justify-center overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-foreground">System</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Display Options</h4>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Compact Mode</p>
                    <p className="text-xs text-muted-foreground">Reduce spacing for more content</p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Animations</p>
                    <p className="text-xs text-muted-foreground">Enable smooth transitions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">Configure how and when you receive notifications.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications} 
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">Browser push notifications</p>
                  </div>
                  <Switch 
                    checked={pushNotifications} 
                    onCheckedChange={setPushNotifications} 
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Weekly Digest</p>
                    <p className="text-xs text-muted-foreground">Summary of weekly activity</p>
                  </div>
                  <Switch 
                    checked={weeklyDigest} 
                    onCheckedChange={setWeeklyDigest} 
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Alert Thresholds</p>
                    <p className="text-xs text-muted-foreground">Notify when metrics exceed limits</p>
                  </div>
                  <Switch 
                    checked={alertThresholds} 
                    onCheckedChange={setAlertThresholds} 
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Goal Reminders</p>
                    <p className="text-xs text-muted-foreground">Remind about upcoming deadlines</p>
                  </div>
                  <Switch 
                    checked={goalReminders} 
                    onCheckedChange={setGoalReminders} 
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Team Updates</p>
                    <p className="text-xs text-muted-foreground">Notifications about team changes</p>
                  </div>
                  <Switch 
                    checked={teamUpdates} 
                    onCheckedChange={setTeamUpdates} 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Connected Integrations</h3>
              <p className="text-sm text-muted-foreground">Manage your connected apps and services.</p>

              <div className="space-y-3">
                {[
                  { name: 'Salesforce', status: 'connected', icon: '☁️' },
                  { name: 'HubSpot', status: 'connected', icon: '🟠' },
                  { name: 'Slack', status: 'connected', icon: '💬' },
                  { name: 'QuickBooks', status: 'disconnected', icon: '📊' },
                  { name: 'Jira', status: 'disconnected', icon: '🔵' },
                ].map((integration) => (
                  <div 
                    key={integration.name}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{integration.name}</p>
                        <p className={cn(
                          "text-xs",
                          integration.status === 'connected' ? "text-success" : "text-muted-foreground"
                        )}>
                          {integration.status === 'connected' ? '● Connected' : '○ Not connected'}
                        </p>
                      </div>
                    </div>
                    <button className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      integration.status === 'connected'
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-primary hover:bg-primary/10"
                    )}>
                      {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-foreground">Security Settings</h3>
              <p className="text-sm text-muted-foreground">Manage your security and authentication settings.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch 
                    checked={twoFactorAuth} 
                    onCheckedChange={setTwoFactorAuth} 
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Audit Logging</p>
                    <p className="text-xs text-muted-foreground">Track all user activities</p>
                  </div>
                  <Switch 
                    checked={auditLogging} 
                    onCheckedChange={setAuditLogging} 
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Session Timeout (minutes)</label>
                <select 
                  value={sessionTimeout} 
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className={inputClass}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="480">8 hours</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>IP Whitelist</label>
                <textarea 
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  placeholder="Enter IP addresses, one per line"
                  className={cn(inputClass, "min-h-[100px] resize-none")}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty to allow all IPs</p>
              </div>

              <div className="pt-4 border-t border-border">
                <button className="px-4 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/20 transition-colors">
                  Revoke All Sessions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button 
          onClick={onClose}
          className="px-5 py-2.5 bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={onClose}
          className="px-5 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all"
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
};
