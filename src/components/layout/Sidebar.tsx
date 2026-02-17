import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  BarChart3,
  Brain,
  DollarSign,
  Briefcase,
  Target,
  Lightbulb,
  MessageSquare,
  HeartPulse,
  Calculator,
  Settings,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TabId } from '@/types/dashboard';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenAccount?: (section?: string) => void;
}

const MAIN_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: BarChart3 },
  { id: 'insights', label: 'Insights', icon: Brain },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'operations', label: 'Operations', icon: Briefcase },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'actions', label: 'Actions', icon: Lightbulb },
];

const TOOLS_NAV = [
  { path: '/tools/health-scorecard', label: 'Business Health Scorecard', icon: HeartPulse },
  { path: '/tools/price-architect', label: 'Price Architect', icon: Calculator },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onOpenAccount }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [mainOpen, setMainOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  const isDashboard = location.pathname === '/';
  const activeTab = searchParams.get('tab') as TabId | null;

  const isNavActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 border-r",
        "bg-sidebar border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[260px]"
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

      {/* Search */}
      {!collapsed && (
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        {/* MAIN Section */}
        <div className="mb-1">
          {!collapsed && (
            <button
              onClick={() => setMainOpen(!mainOpen)}
              className="flex items-center justify-between w-full px-2 py-1.5 mb-1"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Main
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform duration-200",
                  !mainOpen && "-rotate-90"
                )}
              />
            </button>
          )}

          {collapsed ? (
            <Link
              to="/"
              className={cn(
                "flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1",
                isDashboard
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title="Home"
            >
              <BarChart3 size={20} />
            </Link>
          ) : (
            mainOpen && (
              <div className="space-y-0.5">
                {MAIN_TABS.map((tab) => {
                  const isActive = isDashboard && (activeTab === tab.id || (!activeTab && tab.id === 'home'));
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.id}
                      to={`/?tab=${tab.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group",
                        isActive
                          ? "bg-primary/12 text-primary dark:bg-primary/15 dark:text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon size={17} className={cn(
                        "flex-shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className="flex-1">{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Divider */}
        <div className="mx-2 my-2 border-t border-sidebar-border" />

        {/* CHAT Section */}
        <div className="mb-1">
          {!collapsed && (
            <div className="px-2 py-1.5 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chat
              </span>
            </div>
          )}
          <Link
            to="/chat"
            className={cn(
              "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 group",
              collapsed ? "justify-center p-2.5" : "px-3 py-2",
              isNavActive('/chat')
                ? "bg-primary/12 text-primary dark:bg-primary/15 dark:text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title={collapsed ? 'Chat' : undefined}
          >
            <MessageSquare size={collapsed ? 20 : 17} className={cn(
              "flex-shrink-0 transition-colors",
              isNavActive('/chat') ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} />
            {!collapsed && <span>Chat</span>}
          </Link>
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
              {TOOLS_NAV.map((item) => {
                const isActive = isNavActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 group",
                      collapsed ? "justify-center p-2.5" : "px-3 py-2",
                      isActive
                        ? "bg-primary/12 text-primary dark:bg-primary/15 dark:text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={collapsed ? 20 : 17} className={cn(
                      "flex-shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Section: Account icon + Theme toggle + User + Collapse */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        {/* Account icon */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2 py-2" : "px-4 py-2"
        )}>
          <button
            onClick={() => onOpenAccount?.()}
            className={cn(
              "flex items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
              collapsed ? "p-2" : "px-3 py-1.5 w-full text-[13px]"
            )}
            title={collapsed ? 'Account' : undefined}
          >
            <Settings size={16} />
            {!collapsed && <span>Account</span>}
          </button>
        </div>

        {/* Theme toggle */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2 py-2" : "px-4 py-2"
        )}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "flex items-center gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
              collapsed ? "p-2" : "px-3 py-1.5 w-full text-[13px]"
            )}
            title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
        </div>

        {/* User profile */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2 py-3" : "px-4 py-3 gap-3"
        )}>
          <Avatar className={cn("flex-shrink-0", collapsed ? "w-8 h-8" : "w-8 h-8")}>
            <AvatarFallback className="gradient-primary text-white font-semibold text-xs">
              AK
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">Arman Kazemi</div>
              <div className="text-xs text-muted-foreground truncate">arman@tecknocity.com</div>
            </div>
          )}
          {!collapsed && (
            <button
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <div className={cn(
          "flex items-center",
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
