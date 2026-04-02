'use client';

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  MessageSquare,
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
  Coins,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSharedConversations } from '@/contexts/ConversationsContext';
import { useConversationUI } from '@/stores/conversationUI';
import type { Conversation } from '@/hooks/useConversations';
import { useSidebar } from '@/hooks/useSidebar';
import { BineeLogo } from '@/components/BineeLogo';
import { useTheme } from 'next-themes';
import { WARNING_THRESHOLDS } from '@/billing/config';

// Navigation sections removed — sidebar now uses Workspace Setup button + All Chats link + Recents

function getCreditColor(balance: number) {
  const display = Math.floor(balance);
  if (display <= WARNING_THRESHOLDS.empty) {
    return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  }
  if (display <= WARNING_THRESHOLDS.critical) {
    return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  }
  if (display <= WARNING_THRESHOLDS.low) {
    return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
  }
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
}

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting search query when modal opens
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
  const userMenuTriggerRef = useRef<HTMLDivElement>(null);
  const { collapsed, toggle: toggleCollapse } = useSidebar();
  const { resolvedTheme } = useTheme();

  const {
    conversations,
    createConversation,
    deleteConversation,
  } = useSharedConversations();
  const activeConversationId = useConversationUI((s) => s.activeConversationId);
  const setActiveConversation = useConversationUI((s) => s.setActiveConversation);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inMenu = userMenuRef.current?.contains(target);
      const inTrigger = userMenuTriggerRef.current?.contains(target);
      if (!inMenu && !inTrigger) {
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
    // Only navigate — ChatConversationRoute's effect handles setActiveConversation.
    // Calling both causes ChatPage to mount twice (once on /chat with context update,
    // again on /chat/[id] when the URL changes), creating a double-load flash.
    router.push(`/chat/${id}`);
    setMobileOpen(false);
  };

  const recentConversations = conversations.slice(0, 15);

  const initials = (user?.display_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Whether to show collapsed view (only on desktop when collapsed and not mobile-open)
  const showCollapsed = collapsed && !mobileOpen;

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
          collapsed && !mobileOpen ? 'lg:w-16 w-64' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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

        {/* ─── Collapsed view (icons only, desktop) ─── */}
        {showCollapsed ? (
          <div className="hidden lg:flex lg:flex-col lg:h-full items-center">
            {/* Brand */}
            <div className="pt-4 pb-2">
              <Link href="/chat" className="inline-block">
                <BineeLogo variant={resolvedTheme === 'light' ? 'icon-black' : 'icon-white'} width={28} height={28} />
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

            {/* Setup */}
            <Link
              href="/setup"
              className="p-2 rounded-lg text-accent hover:bg-accent/15 transition-colors"
              title="Workspace Setup"
            >
              <Sparkles className="w-4 h-4" />
            </Link>

            {/* New chat */}
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* All Chats */}
            <Link
              href="/chats"
              className={cn(
                'p-2 rounded-lg transition-colors',
                pathname === '/chats' || pathname.startsWith('/chats/')
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
              title="All Chats"
            >
              <MessageSquare className="w-4 h-4" />
            </Link>

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* User avatar at bottom */}
            <div className="p-2 border-t border-border/50 w-full flex justify-center" ref={userMenuTriggerRef}>
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

              {userMenuOpen && (() => {
                const creditColor = getCreditColor(workspace?.credit_balance ?? 0);
                return createPortal(
                  <div ref={userMenuRef} className="fixed bottom-16 left-2 w-64 bg-navy-light border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        {user?.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-accent/25 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border-2 border-accent/25 flex items-center justify-center shrink-0">
                            <span className="text-accent text-sm font-bold">{initials}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary truncate">{user?.display_name || 'User'}</p>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">{workspace?.name || 'Workspace'}</p>
                          <p className="text-[11px] text-text-muted truncate">{user?.email || ''}</p>
                        </div>
                      </div>

                      {/* Color-coded credit balance pill */}
                      <Link
                        href="/settings?tab=billing"
                        onClick={() => { setUserMenuOpen(false); }}
                        className={cn(
                          'mt-3 flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-colors hover:brightness-125',
                          creditColor.bg,
                          creditColor.border
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Coins className={cn('w-3.5 h-3.5', creditColor.text)} />
                          <span className={cn('text-xs font-medium', creditColor.text)}>Credits</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={cn('text-sm font-semibold font-mono', creditColor.text)}>
                            {workspace?.credit_balance != null ? Math.floor(workspace.credit_balance).toLocaleString() : '---'}
                          </span>
                          {(workspace?.credit_balance ?? 0) <= WARNING_THRESHOLDS.empty && (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </div>
                      </Link>
                    </div>

                    <div className="py-1.5">
                      <Link
                        href="/settings"
                        onClick={() => { setUserMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Settings</span>
                      </Link>
                      <Link
                        href="/settings?tab=billing"
                        onClick={() => { setUserMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">View all plans</span>
                      </Link>
                      <Link
                        href="/settings?tab=integrations"
                        onClick={() => { setUserMenuOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Plug className="w-4 h-4" />
                        <span className="text-sm">Integrations</span>
                      </Link>
                    </div>

                    <div className="border-t border-border/40" />

                    <div className="py-1.5">
                      <button
                        onClick={async () => {
                          await signOut();
                          setUserMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Log out</span>
                      </button>
                    </div>
                  </div>,
                  document.body
                );
              })()}
            </div>
          </div>
        ) : (
          /* ─── Expanded view (full content) ─── */
          <div className="flex flex-col h-full">
            {/* Brand + collapse toggle */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <Link href="/chat" className="inline-block" onClick={() => setMobileOpen(false)}>
                <span className="text-xl font-black text-text-primary tracking-wide" style={{ fontFamily: "'Heebo', sans-serif" }}>BINEE</span>
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

            {/* Setup button — prominent, at the top */}
            <Link
              href="/setup"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 p-3 mx-3 mt-3 mb-2 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors"
            >
              <Sparkles className="w-5 h-5 text-accent" />
              <span className="font-medium text-accent">Workspace Setup</span>
            </Link>

            {/* New chat + All Chats + Search */}
            <div className="px-3 pt-2 pb-1 space-y-0.5">
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
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname === '/chats' || pathname.startsWith('/chats/')
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <MessageSquare className="w-4 h-4" />
                All Chats
              </Link>
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

            {/* Recent chats */}
            <div className="flex-1 overflow-y-auto px-3 min-h-0">
              <p className="px-3 py-1.5 text-[11px] font-medium text-text-muted">
                Recents
              </p>
              <div className="space-y-0.5">
                {recentConversations.map((conv) => {
                  const isActive = conv.id === activeConversationId && pathname.startsWith('/chat');
                  return (
                    <div
                      key={conv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectConversation(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectConversation(conv.id);
                        }
                      }}
                      className={cn(
                        'group w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate relative cursor-pointer',
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
                    </div>
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

              {userMenuOpen && (() => {
                const creditColor = getCreditColor(workspace?.credit_balance ?? 0);
                return (
                  <div className="absolute bottom-full left-3 right-3 mb-2 bg-navy-light border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 pt-4 pb-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        {user?.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-accent/25 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border-2 border-accent/25 flex items-center justify-center shrink-0">
                            <span className="text-accent text-sm font-bold">{initials}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary truncate">{user?.display_name || 'User'}</p>
                          <p className="text-[11px] text-text-muted truncate mt-0.5">{workspace?.name || 'Workspace'}</p>
                          <p className="text-[11px] text-text-muted truncate">{user?.email || ''}</p>
                        </div>
                      </div>

                      {/* Color-coded credit balance pill */}
                      <Link
                        href="/settings?tab=billing"
                        onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                        className={cn(
                          'mt-3 flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-colors hover:brightness-125',
                          creditColor.bg,
                          creditColor.border
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Coins className={cn('w-3.5 h-3.5', creditColor.text)} />
                          <span className={cn('text-xs font-medium', creditColor.text)}>Credits</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={cn('text-sm font-semibold font-mono', creditColor.text)}>
                            {workspace?.credit_balance != null ? Math.floor(workspace.credit_balance).toLocaleString() : '---'}
                          </span>
                          {(workspace?.credit_balance ?? 0) <= WARNING_THRESHOLDS.empty && (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </div>
                      </Link>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      <Link
                        href="/settings"
                        onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Settings</span>
                      </Link>

                      <Link
                        href="/settings?tab=billing"
                        onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">View all plans</span>
                      </Link>

                      <Link
                        href="/settings?tab=integrations"
                        onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Plug className="w-4 h-4" />
                        <span className="text-sm">Integrations</span>
                      </Link>
                    </div>

                    <div className="border-t border-border/40" />

                    {/* Sign out */}
                    <div className="py-1.5">
                      <button
                        onClick={async () => {
                          await signOut();
                          setUserMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Log out</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
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
