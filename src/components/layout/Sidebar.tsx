'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  MessageSquare,
  LayoutDashboard,
  HeartPulse,
  Wrench,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronUp,
  Hexagon,
  Plus,
  Search,
  Trash2,
  CreditCard,
  Plug,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversations, type Conversation } from '@/hooks/useConversations';

const navSections = [
  { href: '/chats', label: 'Chats', icon: MessageSquare },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/setup', label: 'Setup', icon: Wrench },
];

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useConversations();

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

  const handleNewChat = () => {
    createConversation();
    router.push('/chat');
    setMobileOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    router.push('/chat');
    setMobileOpen(false);
  };

  const recentConversations = conversations.slice(0, 15);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 pt-4 pb-2">
        <Link href="/chat" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Hexagon className="w-4 h-4 text-accent" />
          </div>
          <span className="text-base font-bold text-text-primary tracking-tight">Binee</span>
        </Link>
      </div>

      {/* New chat + Search */}
      <div className="px-3 pt-2 pb-1 space-y-1">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <Link
          href="/chats"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Search className="w-4 h-4" />
          Search
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 my-1.5 border-t border-border/50" />

      {/* Navigation sections */}
      <nav className="px-3 space-y-0.5">
        {navSections.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-1.5 border-t border-border/50" />

      {/* Recent chats */}
      <div className="flex-1 overflow-y-auto px-3 min-h-0">
        <p className="px-3 py-1.5 text-[11px] font-medium text-text-muted">
          Recents
        </p>
        <div className="space-y-0.5">
          {recentConversations.map((conv) => {
            const isActive = conv.id === activeConversationId && pathname.startsWith('/chat');
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  'group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate relative',
                  isActive
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover/50 hover:text-text-primary'
                )}
              >
                <span className="truncate block pr-6">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/10 text-text-muted hover:text-error transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            );
          })}
          {recentConversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-muted/60 text-center">
              No recent chats
            </p>
          )}
        </div>
      </div>

      {/* User section at bottom */}
      <div className="p-3 border-t border-border/50 relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors',
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
            <p className="text-[11px] text-text-muted truncate leading-none mt-0.5">
              {workspace?.plan ? `${workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)} plan` : ''}
            </p>
          </div>
          <ChevronUp className={cn(
            'w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200',
            !userMenuOpen && 'rotate-180'
          )} />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-navy-light border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
            {/* Email display */}
            <div className="px-3.5 py-2 border-b border-border/50">
              <p className="text-xs text-text-muted truncate">{user?.email || ''}</p>
            </div>

            {/* Settings */}
            <Link
              href="/settings"
              onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Link>

            {/* Usage / Billing */}
            <Link
              href="/billing"
              onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm">Usage</span>
              <span className="ml-auto text-xs text-text-muted font-mono">
                {workspace?.credit_balance?.toLocaleString() ?? '---'} credits
              </span>
            </Link>

            {/* View all plans */}
            <Link
              href="/billing"
              onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">View all plans</span>
            </Link>

            {/* Integrations */}
            <Link
              href="/integrations"
              onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Plug className="w-4 h-4" />
              <span className="text-sm">Integrations</span>
            </Link>

            <div className="my-1 border-t border-border/50" />

            {/* Sign out */}
            <button
              onClick={async () => {
                await signOut();
                setUserMenuOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Log out</span>
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
          className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors lg:hidden"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
