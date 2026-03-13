'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  Plus,
  Search,
  Trash2,
  CreditCard,
  Plug,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { useSidebar } from '@/hooks/useSidebar';

const navSections = [
  { href: '/chats', label: 'Chats', icon: MessageSquare },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/setup', label: 'Setup', icon: Wrench },
];

// ---------------------------------------------------------------------------
// Search Dialog
// ---------------------------------------------------------------------------

function SearchDialog({
  open,
  onClose,
  conversations,
  onSelectConversation,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog — larger and centered like Claude */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl mx-6 bg-navy-dark border border-accent/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and projects"
            className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length > 0 ? (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onClose();
                }}
                className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-surface-hover transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-text-muted shrink-0" />
                <span className="text-sm text-text-primary truncate flex-1">
                  {conv.title}
                </span>
                <span className="text-xs text-text-muted shrink-0">
                  {formatRelativeDate(conv.updatedAt)}
                </span>
              </button>
            ))
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-text-muted">
                {query ? 'No results found' : 'No chats yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { collapsed, toggle: toggleCollapse } = useSidebar();

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

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleNewChat = () => {
    setActiveConversation(null);
    router.push('/chat?new=1');
    setMobileOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    router.push('/chat');
    setMobileOpen(false);
  };

  const recentConversations = conversations.slice(0, 15);

  const initials = (user?.display_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ─── Collapsed sidebar (icons only) ───────────────────────
  const collapsedContent = (
    <div className="flex flex-col h-full items-center">
      {/* Brand */}
      <div className="pt-4 pb-2">
        <Link href="/chat" className="inline-block">
          <span className="text-lg font-bold text-text-primary">B</span>
        </Link>
      </div>

      {/* Expand button */}
      <button
        onClick={toggleCollapse}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors my-1"
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>

      {/* New chat */}
      <button
        onClick={handleNewChat}
        className="p-2 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        title="New chat"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="p-2 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        title="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-6 my-1.5 border-t border-border/50" />

      {/* Navigation sections */}
      <nav className="space-y-1">
        {navSections.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar at bottom */}
      <div className="p-2 border-t border-border/50 w-full flex justify-center" ref={collapsed ? userMenuRef : undefined}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          title={user?.display_name || 'User'}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-accent/20" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">{initials}</span>
            </div>
          )}
        </button>

        {userMenuOpen && collapsed && (
          <div className="absolute bottom-12 left-2 w-56 bg-navy-light border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
            <div className="px-3.5 py-2 border-b border-border/50">
              <p className="text-xs text-text-muted truncate">{user?.email || ''}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => { setUserMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Link>
            <Link
              href="/settings?tab=billing"
              onClick={() => { setUserMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm">Usage</span>
            </Link>
            <Link
              href="/settings?tab=integrations"
              onClick={() => { setUserMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <Plug className="w-4 h-4" />
              <span className="text-sm">Integrations</span>
            </Link>
            <div className="my-1 border-t border-border/50" />
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

  // ─── Expanded sidebar (full content) ──────────────────────
  const expandedContent = (
    <div className="flex flex-col h-full">
      {/* Brand + collapse toggle */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <Link href="/chat" className="inline-block" onClick={() => setMobileOpen(false)}>
          <span className="text-xl font-bold text-text-primary tracking-tight">BINEE</span>
        </Link>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors hidden lg:flex"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
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
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
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
      <div className="p-3 border-t border-border/50 relative" ref={!collapsed ? userMenuRef : undefined}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors',
            userMenuOpen ? 'bg-surface-hover' : 'hover:bg-surface-hover'
          )}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-accent/20 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <span className="text-accent text-xs font-bold">{initials}</span>
            </div>
          )}
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

        {userMenuOpen && !collapsed && (
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
              href="/settings?tab=billing"
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
              href="/settings?tab=billing"
              onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">View all plans</span>
            </Link>

            {/* Integrations */}
            <Link
              href="/settings?tab=integrations"
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
          'fixed inset-y-0 left-0 z-40 bg-navy-dark border-r border-border/50 flex flex-col transition-all duration-200 ease-out lg:translate-x-0 lg:static lg:z-auto lg:h-dvh shrink-0 overflow-hidden',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
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

        {/* Show collapsed content on desktop when collapsed, always expanded on mobile */}
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          {collapsed ? collapsedContent : expandedContent}
        </div>
        <div className="flex flex-col h-full lg:hidden">
          {expandedContent}
        </div>
      </aside>

      {/* Search popup */}
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
      />
    </>
  );
}
