import React, { useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, LogOut, CreditCard, Puzzle, RefreshCw, Database } from 'lucide-react';
import { ViewMode } from '../../types/dashboard';
import { cn } from '@/lib/utils';

interface HeaderProps {
  viewMode: ViewMode;
  showAccountMenu: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onAccountMenuToggle: (show: boolean) => void;
  onSettingsClick: () => void;
  onMappingClick: () => void;
  onRefreshClick: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode, showAccountMenu, onViewModeChange, onAccountMenuToggle, onSettingsClick, onMappingClick, onRefreshClick, onLogout,
}) => {
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (showAccountMenu && accountMenuRef.current && accountButtonRef.current &&
        !accountMenuRef.current.contains(event.target as Node) && !accountButtonRef.current.contains(event.target as Node)) {
      onAccountMenuToggle(false);
    }
  }, [showAccountMenu, onAccountMenuToggle]);

  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && showAccountMenu) onAccountMenuToggle(false);
  }, [showAccountMenu, onAccountMenuToggle]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleClickOutside, handleEscapeKey]);

  return (
    <header className="glass-strong sticky top-0 z-50 border-b border-primary/20 px-8 py-6">
      <div className="flex justify-between items-center max-w-[1800px] mx-auto">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">
              Business Command Center
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">AI-powered business intelligence</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Navigation Links */}
          <Link
            to="/integrations"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200 text-sm font-medium"
          >
            <Puzzle size={16} />
            Integrations
          </Link>

          <button 
            onClick={onMappingClick} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info/10 border border-info/30 text-info hover:bg-info/20 transition-all duration-200 text-sm font-medium"
          >
            <Database size={16} />
            Data Mapping
          </button>

          <button 
            onClick={onRefreshClick} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white hover:opacity-90 transition-all duration-200 text-sm font-semibold shadow-glow-sm hover:shadow-glow"
          >
            <RefreshCw size={16} />
            Refresh Data
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-secondary/50 rounded-xl p-1 ml-2">
            <button 
              onClick={() => onViewModeChange('company')} 
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                viewMode === 'company' 
                  ? "gradient-primary text-white shadow-glow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Company View
            </button>
            <button 
              onClick={() => onViewModeChange('binee')} 
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                viewMode === 'binee' 
                  ? "gradient-primary text-white shadow-glow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Binee View
            </button>
          </div>

          {/* Account Menu */}
          <div className="relative ml-2">
            <button 
              ref={accountButtonRef} 
              onClick={() => onAccountMenuToggle(!showAccountMenu)} 
              aria-expanded={showAccountMenu} 
              aria-haspopup="true" 
              aria-label="Account menu" 
              className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center transition-all duration-200 hover:shadow-glow hover:scale-105"
            >
              <User size={20} className="text-white" />
            </button>

            {showAccountMenu && (
              <div 
                ref={accountMenuRef} 
                role="menu" 
                className="absolute top-full right-0 mt-2 w-60 bg-card rounded-xl border border-border shadow-card animate-scale-in overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <div className="font-semibold text-foreground">John Doe</div>
                  <div className="text-sm text-muted-foreground">john@company.com</div>
                </div>

                <div className="py-1">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <User size={16} className="text-muted-foreground" /> Profile
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <Settings size={16} className="text-muted-foreground" /> Settings
                  </Link>

                  <Link
                    to="/billing"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <CreditCard size={16} className="text-muted-foreground" /> Billing
                  </Link>
                </div>

                <div className="border-t border-border py-1">
                  <button
                    role="menuitem"
                    onClick={() => { onLogout(); onAccountMenuToggle(false); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-destructive hover:bg-destructive/10 transition-colors text-sm w-full"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
