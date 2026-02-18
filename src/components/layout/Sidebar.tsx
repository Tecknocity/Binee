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
  HeartPulse,
  Calculator,
  Plug,
  Database,
  AlertCircle,
  Shield,
  LogOut,
  ChevronDown,
  User,
  Settings,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useAppearance } from '@/contexts/AppearanceContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TabId } from '@/types/dashboard';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  autoHide?: boolean;
}

const TOOLS_NAV = [
  { path: '/tools/health-scorecard', label: 'Business Health Scorecard', icon: HeartPulse },
  { path: '/tools/price-architect', label: 'Price Architect', icon: Calculator },
];

const DATA_NAV = [
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/data-mapping', label: 'Data Mapping', icon: Database },
  { path: '/data-quality', label: 'Data Quality & Issues', icon: AlertCircle },
  { path: '/rules', label: 'Rules', icon: Shield },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, autoHide = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { viewMode, setViewMode } = useViewMode();
  const { defaultTab } = useAppearance();
  const profile = useProfile();
  const [toolsOpen, setToolsOpen] = useState(true);
  const [dataOpen, setDataOpen] = useState(true);
  const [userPopupOpen, setUserPopupOpen] = useState(false);
  const userPopupRef = useRef<HTMLDivElement>(null);

  const isDashboard = location.pathname === '/';
  const activeTab = searchParams.get('tab') as TabId | null;

  const isNavActive = (path: string) => location.pathname === path;

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
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
        {/* Top-level tabs: Home, Chat, Goals, Growth, Operations, Insights, Actions */}
        <div className="space-y-0.5 mb-1">
          {(() => {
            // When no tab param, use the default landing tab from appearance settings
            const effectiveTab = activeTab || (defaultTab as TabId) || 'home';
            return (
              <>
                {renderNavItem('home', '/?tab=home', 'Home', BarChart3,
                  isDashboard && effectiveTab === 'home')}
                {renderNavItem('chat', '/chat', 'Chat', MessageSquare,
                  isNavActive('/chat'))}
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
              </>
            );
          })()}
        </div>

        {/* Divider */}
        <div className="mx-2 my-2 border-t border-sidebar-border" />

        {/* TOOLS Section (collapsible) */}
        <div className="mb-1">
          {!collapsed && (
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className="flex items-center justify-between w-full px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tools
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform duration-200",
                  !toolsOpen && "-rotate-90"
                )}
              />
            </button>
          )}
          {(collapsed || toolsOpen) && (
            <div className="space-y-0.5">
              {TOOLS_NAV.map((item) =>
                renderNavItem(item.path, item.path, item.label, item.icon, isNavActive(item.path))
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-2 my-2 border-t border-sidebar-border" />

        {/* DATA Section (collapsible) */}
        <div className="mb-1">
          {!collapsed && (
            <button
              onClick={() => setDataOpen(!dataOpen)}
              className="flex items-center justify-between w-full px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform duration-200",
                  !dataOpen && "-rotate-90"
                )}
              />
            </button>
          )}
          {(collapsed || dataOpen) && (
            <div className="space-y-0.5">
              {DATA_NAV.map((item) =>
                renderNavItem(item.path, item.path, item.label, item.icon, isNavActive(item.path))
              )}
            </div>
          )}
        </div>
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
              </div>

              {/* Company / Binee view toggle */}
              <div className="px-4 pb-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  View Mode
                </div>
                <div className="flex bg-muted/50 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('company')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center",
                      viewMode === 'company'
                        ? "gradient-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Company
                  </button>
                  <button
                    onClick={() => setViewMode('binee')}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center",
                      viewMode === 'binee'
                        ? "gradient-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Binee
                  </button>
                </div>
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
