import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { User, Shield, Bell, Palette, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { path: '/settings/profile', label: 'Profile', icon: User },
  { path: '/settings/security', label: 'Security', icon: Shield },
  { path: '/settings/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings/appearance', label: 'Appearance', icon: Palette },
  { path: '/settings/data-privacy', label: 'Data & Privacy', icon: Database },
];

const SettingsLayout: React.FC = () => {
  return (
    <div className="text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-60 flex-shrink-0">
            <div className="bg-card rounded-xl border border-border p-2 md:sticky md:top-28">
              {/* Horizontal scroll on mobile, vertical list on desktop */}
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <NavLink
                      key={section.path}
                      to={section.path}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                          isActive
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )
                      }
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {section.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
