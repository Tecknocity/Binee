'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher';
import {
  MessageSquare,
  LayoutDashboard,
  HeartPulse,
  Wrench,
  Settings,
  LogOut,
  Coins,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCredits } from '@/lib/utils';

const navItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/setup', label: 'Setup', icon: Wrench },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, workspace, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Workspace switcher */}
      <div className="p-3 border-b border-border">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <Icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Credit balance */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg">
          <Coins className="w-4 h-4 text-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Credits</p>
            <p className="text-sm font-semibold text-text-primary">
              {workspace ? formatCredits(workspace.credit_balance) : '---'}
            </p>
          </div>
        </div>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-border relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <span className="text-accent text-xs font-bold">
              {user?.display_name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??'}
            </span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.display_name || 'User'}</p>
            <p className="text-xs text-text-muted truncate">{user?.email || ''}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-navy-light border border-border rounded-lg shadow-xl z-50 py-1">
            <button
              onClick={async () => {
                await signOut();
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 bg-navy-light border border-border rounded-lg lg:hidden"
      >
        <Menu className="w-5 h-5 text-text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-navy-dark border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-primary lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
