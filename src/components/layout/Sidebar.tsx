import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Brain,
  TrendingUp,
  Briefcase,
  Lightbulb,
  MessageSquare,
  Target,
  LogOut,
  ChevronDown,
  User,
  Settings,
  CreditCard,
  Database,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useChat } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TabId } from '@/types/dashboard';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  autoHide?: boolean;
}

// Group conversations by relative date
function groupByDate(conversations: { id: string; title: string; updatedAt: string }[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: typeof conversations }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Last 7 days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= weekAgo) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, autoHide = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { defaultTab } = useAppearance();
  const profile = useProfile();
  const chat = useChat();
  const [userPopupOpen, setUserPopupOpen] = useState(false);
  const userPopupRef = useRef<HTMLDivElement>(null);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  const isDashboard = location.pathname === '/';
  const isOnChat = location.pathname.startsWith('/chat');
  const activeTab = searchParams.get('tab') as TabId | null;

  // Close user popup on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (userPopupOpen && userPopupRef.current && !userPopupRef.current.contains(e.target as Node)) {
      setUserPopupOpen(false);
    }
  }, [userPopupOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserPopupOpen(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const handleNewChat = () => {
    const id = chat.createConversation();
    navigate(`/chat/${id}`);
  };

  const handleSelectChat = (convId: string) => {
    chat.setActiveConversationId(convId);
    navigate(`/chat/${convId}`);
  };

  // Render a single nav link (tab or route)
  const renderNavItem = (
    key: string,
    to: string,
    label: string,
    Icon: React.ElementType,
    active: boolean
  ) => (
    <Link
      key={key}
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 group",
        collapsed ? "justify-center p-2.5" : "px-3 py-2",
        active
          ? "bg-primary/12 text-primary dark:bg-primary/15 dark:text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon size={collapsed ? 20 : 17} className={cn(
        "flex-shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  // Section header (collapsible toggle)
  const renderSectionHeader = (
    label: string,
    Icon: React.ElementType,
    isOpen: boolean,
    onToggleSection: () => void
  ) => (
    <button
      onClick={collapsed ? undefined : onToggleSection}
      className={cn(
        "flex items-center w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors",
        collapsed ? "justify-center py-2" : "gap-2 px-3 py-2 hover:text-muted-foreground"
      )}
      title={collapsed ? label : undefined}
    >
      {collapsed ? (
        <Icon size={16} className="text-muted-foreground/50" />
      ) : (
        <>
          <ChevronDown
            size={12}
            className={cn(
              "transition-transform duration-200 flex-shrink-0",
              !isOpen && "-rotate-90"
            )}
          />
          <span>{label}</span>
        </>
      )}
    </button>
  );

  const effectiveTab = activeTab || (defaultTab as TabId) || 'home';
  const chatGroups = groupByDate(chat.filteredConversations);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 border-r",
        "bg-sidebar border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[260px]",
        autoHide && !collapsed && "shadow-2xl"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-sidebar-border flex-shrink-0",
        collapsed ? "px-3 py-4 justify-center" : "px-5 py-4"
      )}>
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg flex-shrink-0">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold gradient-text whitespace-nowrap">Binee</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 flex flex-col min-h-0">
        {/* ──────────────── Dashboard Section ──────────────── */}
        {renderSectionHeader('Dashboard', BarChart3, dashboardOpen, () => setDashboardOpen(!dashboardOpen))}
        {(dashboardOpen || collapsed) && (
          <div className="space-y-0.5 mb-2">
            {renderNavItem('home', '/?tab=home', 'Home', BarChart3,
              isDashboard && effectiveTab === 'home')}
            {renderNavItem('goals', '/?tab=goals', 'Goals', Target,
              isDashboard && effectiveTab === 'goals')}
            {renderNavItem('growth', '/?tab=growth', 'Growth', TrendingUp,
              isDashboard && effectiveTab === 'growth')}
            {renderNavItem('operations', '/?tab=operations', 'Operations', Briefcase,
              isDashboard && effectiveTab === 'operations')}
            {renderNavItem('insights', '/?tab=insights', 'Insights', Brain,
              isDashboard && effectiveTab === 'insights')}
            {renderNavItem('actions', '/?tab=actions', 'Actions', Lightbulb,
              isDashboard && effectiveTab === 'actions')}
          </div>
        )}

        {/* ──────────────── Chat Section ──────────────── */}
        <div className="mt-1">
          {renderSectionHeader('Chat', MessageSquare, chatOpen, () => setChatOpen(!chatOpen))}
        </div>

        {(chatOpen || collapsed) && (
          <div className="flex flex-col min-h-0 flex-1">
            {/* New Chat button */}
            {collapsed ? (
              <button
                onClick={handleNewChat}
                className="flex justify-center p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                title="New Chat"
              >
                <Plus size={20} />
              </button>
            ) : (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 mx-0 px-3 py-2 mb-2 text-[13px] font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors"
              >
                <Plus size={15} />
                <span>New Chat</span>
              </button>
            )}

            {/* Search (expanded only) */}
            {!collapsed && (
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={chat.searchQuery}
                  onChange={(e) => chat.setSearchQuery(e.target.value)}
                  className="w-full bg-muted/30 border border-border/40 rounded-lg py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:bg-muted/50 transition-colors"
                />
              </div>
            )}

            {/* Conversation list */}
            {!collapsed && (
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                {chatGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-2 mb-1">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((conv) => {
                        const isActive = isOnChat && chat.activeConversationId === conv.id;
                        return (
                          <button
                            key={conv.id}
                            onClick={() => handleSelectChat(conv.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-[13px] truncate transition-all duration-150",
                              isActive
                                ? "bg-primary/12 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                            title={conv.title}
                          >
                            {conv.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {chatGroups.length === 0 && chat.searchQuery && (
                  <div className="text-xs text-muted-foreground/50 text-center py-4">
                    No chats found
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Section: User profile + Collapse */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        {/* User profile — click opens popup */}
        <div className={cn("relative", collapsed ? "px-2 py-3" : "px-4 py-3")} ref={userPopupRef}>
          <button
            onClick={() => setUserPopupOpen(!userPopupOpen)}
            className={cn(
              "flex items-center w-full rounded-lg hover:bg-muted/50 transition-all",
              collapsed ? "justify-center p-1" : "gap-3 px-1 py-1"
            )}
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              {profile.avatar && <AvatarImage src={profile.avatar} alt={profile.name} />}
              <AvatarFallback className="gradient-primary text-white font-semibold text-xs">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">{profile.name.split(' ')[0]}</div>
                <div className="text-xs text-muted-foreground truncate">{profile.company}</div>
              </div>
            )}
            {!collapsed && (
              <ChevronDown size={14} className={cn(
                "text-muted-foreground transition-transform duration-200 flex-shrink-0",
                userPopupOpen && "rotate-180"
              )} />
            )}
          </button>

          {/* User popup menu */}
          {userPopupOpen && (
            <div className={cn(
              "absolute bg-card rounded-xl border border-border shadow-2xl overflow-hidden animate-scale-in z-[60]",
              collapsed ? "left-[72px] bottom-0 w-72" : "left-0 bottom-full mb-2 w-full"
            )}>
              {/* User info header */}
              <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-b border-border/50">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {profile.company}
                </div>
                <div className="font-semibold text-foreground">{profile.name}</div>
                <div className="text-sm text-muted-foreground">{profile.email}</div>
              </div>

              {/* Menu items */}
              <div className="p-2">
                <button
                  onClick={() => { setUserPopupOpen(false); navigate('/settings/profile'); }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
                >
                  <div className="flex items-center gap-3">
                    <User size={16} className="text-muted-foreground" />
                    <span>My Profile</span>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setUserPopupOpen(false); navigate('/settings'); }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={16} className="text-muted-foreground" />
                    <span>Settings</span>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setUserPopupOpen(false); navigate('/billing'); }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={16} className="text-muted-foreground" />
                    <span>Billing</span>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setUserPopupOpen(false); navigate('/data-management'); }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
                >
                  <div className="flex items-center gap-3">
                    <Database size={16} className="text-muted-foreground" />
                    <span>Data Management</span>
                  </div>
                  <ExternalLink size={12} className="text-muted-foreground" />
                </button>
              </div>

              {/* Sign out */}
              <div className="p-2 border-t border-border/50">
                <button
                  onClick={() => setUserPopupOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm w-full"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div className={cn(
          "flex items-center border-t border-sidebar-border",
          collapsed ? "justify-center px-2 py-2" : "px-4 py-2"
        )}>
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
              collapsed ? "p-2" : "px-3 py-1.5 w-full text-[13px]"
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
