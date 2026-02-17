import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

type DensityOption = 'comfortable' | 'compact';
type SidebarBehavior = 'expanded' | 'collapsed' | 'auto-hide';

const LANDING_TABS = [
  { value: 'home', label: 'Home' },
  { value: 'goals', label: 'Goals' },
  { value: 'growth', label: 'Growth' },
  { value: 'operations', label: 'Operations' },
  { value: 'insights', label: 'Insights' },
  { value: 'actions', label: 'Actions' },
];

const AppearanceSection: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<DensityOption>('comfortable');
  const [landingTab, setLandingTab] = useState('home');
  const [sidebarBehavior, setSidebarBehavior] = useState<SidebarBehavior>('expanded');

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast.success('Settings saved!');
  };

  const handleDensityChange = (newDensity: DensityOption) => {
    setDensity(newDensity);
    toast.success('Settings saved!');
  };

  const handleSidebarChange = (newBehavior: SidebarBehavior) => {
    setSidebarBehavior(newBehavior);
    toast.success('Settings saved!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how the dashboard looks and feels
        </p>
      </div>

      {/* Theme Selector */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Theme</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Dark Theme Card */}
          <button
            onClick={() => handleThemeChange('dark')}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              theme === 'dark'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {/* Preview Thumbnail */}
            <div className="w-full h-24 rounded-lg bg-slate-900 border border-slate-700 mb-3 p-2 overflow-hidden">
              <div className="w-full h-2 rounded bg-slate-700 mb-1.5" />
              <div className="w-3/4 h-2 rounded bg-slate-700 mb-1.5" />
              <div className="flex gap-1 mt-2">
                <div className="w-1/3 h-8 rounded bg-slate-800 border border-slate-700" />
                <div className="w-1/3 h-8 rounded bg-slate-800 border border-slate-700" />
                <div className="w-1/3 h-8 rounded bg-slate-800 border border-slate-700" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Moon size={16} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Dark</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Easy on the eyes</p>
            {theme === 'dark' && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>

          {/* Light Theme Card */}
          <button
            onClick={() => handleThemeChange('light')}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              theme === 'light'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {/* Preview Thumbnail */}
            <div className="w-full h-24 rounded-lg bg-gray-100 border border-gray-200 mb-3 p-2 overflow-hidden">
              <div className="w-full h-2 rounded bg-gray-300 mb-1.5" />
              <div className="w-3/4 h-2 rounded bg-gray-300 mb-1.5" />
              <div className="flex gap-1 mt-2">
                <div className="w-1/3 h-8 rounded bg-white border border-gray-200" />
                <div className="w-1/3 h-8 rounded bg-white border border-gray-200" />
                <div className="w-1/3 h-8 rounded bg-white border border-gray-200" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sun size={16} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Light</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Bright and clean</p>
            {theme === 'light' && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Dashboard Density */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Dashboard Density</h3>
        <div className="grid grid-cols-2 gap-4">
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              density === 'comfortable'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="density"
              value="comfortable"
              checked={density === 'comfortable'}
              onChange={() => handleDensityChange('comfortable')}
              className="sr-only"
            />
            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
              {density === 'comfortable' && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Comfortable</p>
              <p className="text-xs text-muted-foreground">More spacing between elements</p>
            </div>
          </label>

          <label
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              density === 'compact'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="density"
              value="compact"
              checked={density === 'compact'}
              onChange={() => handleDensityChange('compact')}
              className="sr-only"
            />
            <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
              {density === 'compact' && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Compact</p>
              <p className="text-xs text-muted-foreground">Denser layout, more content</p>
            </div>
          </label>
        </div>
      </div>

      {/* Default Landing Tab */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Default Landing Tab</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Choose which tab opens first when you visit the dashboard
        </p>
        <select
          value={landingTab}
          onChange={(e) => {
            setLandingTab(e.target.value);
            toast.success('Settings saved!');
          }}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/50 outline-none appearance-none cursor-pointer"
        >
          {LANDING_TABS.map((tab) => (
            <option key={tab.value} value={tab.value}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sidebar Behavior */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Sidebar Behavior</h3>
        <div className="space-y-3">
          {([
            { value: 'expanded' as const, label: 'Expanded', description: 'Sidebar is always visible and open' },
            { value: 'collapsed' as const, label: 'Collapsed', description: 'Sidebar shows icons only' },
            { value: 'auto-hide' as const, label: 'Auto-hide', description: 'Sidebar hides and shows on hover' },
          ]).map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                sidebarBehavior === option.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="sidebar-behavior"
                value={option.value}
                checked={sidebarBehavior === option.value}
                onChange={() => handleSidebarChange(option.value)}
                className="sr-only"
              />
              <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
                {sidebarBehavior === option.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSection;
