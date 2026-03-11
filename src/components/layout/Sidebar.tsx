'use client';

import { useState, useRef, useEffect } from 'react';
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
  Hexagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCredits } from '@/lib/utils';

const mainNavItems = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/setup', label: 'Setup', icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, workspace, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-5 pt-5 pb-3">
        <Link href="/chat" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <Hexagon className="w-4.5 h-4.5 text-accent" />
          </div>
          <span className="text-lg font-bold text-text-primary tracking-tight">Binee</span>
        </Link>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pb-2">
        <WorkspaceSwitcher />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">
          Menu
        </p>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-1 space-y-1">
        {/* Credit balance */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface/80 rounded-xl border border-border/50">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-text-muted leading-none mb-0.5">Credits remaining</p>
            <p className="text-sm font-bold text-text-primary leading-none">
              {workspace ? formatCredits(workspace.credit_balance) : '---'}
            </p>
          </div>
        </div>

        {/* Settings link */}
        {(() => {
          const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
          return (
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isSettingsActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <Settings className="w-[18px] h-[18px]" />
              Settings
            </Link>
          );
        })()}
      </div>

      {/* User section */}
      <div className="p-3 border-t border-border/50 relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-colors',
            userMenuOpen ? 'bg-surface-hover' : 'hover:bg-surface-hover'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-accent text-xs font-bold">
              {user?.display_name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??'}
            </span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.display_name || 'User'}</p>
            <p className="text-[11px] text-text-muted truncate leading-none mt-0.5">{user?.email || ''}</p>
          </div>
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200',
            userMenuOpen && 'rotate-180'
          )} />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-navy-light border border-border rounded-xl shadow-2xl z-50 py-1.5">
            <button
              onClick={async () => {
                await signOut();
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
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
        className="fixed top-4 left-4 z-50 p-2.5 bg-navy-dark/90 backdrop-blur-sm border border-border rounded-xl lg:hidden shadow-lg"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5 text-text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-navy-dark border-r border-border/50 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-5 right-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors lg:hidden"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
