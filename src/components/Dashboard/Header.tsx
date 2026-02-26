import React, { useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, LogOut, CreditCard, Puzzle, RefreshCw, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  showAccountMenu: boolean;
  onAccountMenuToggle: (show: boolean) => void;
  onSettingsClick: () => void;
  onRefreshClick: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showAccountMenu, onAccountMenuToggle, onSettingsClick, onRefreshClick, onLogout,
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
    <header className="bg-background/95 backdrop-blur-xl sticky top-0 z-50 border-b border-border/40">
      <div className="flex justify-between items-center max-w-[1800px] mx-auto px-6 py-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
            <span className="text-primary-foreground font-bold text-xl">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text tracking-tight">
              Business Command Center
            </h1>
            <p className="text-muted-foreground text-xs">AI-powered business intelligence</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground hover:opacity-90 transition-all duration-200 text-sm font-semibold shadow-md"
          >
            <RefreshCw size={15} />
            Refresh Data
          </button>

          {/* Account Menu */}
          <div className="relative ml-1">
            <button 
              ref={accountButtonRef} 
              onClick={() => onAccountMenuToggle(!showAccountMenu)} 
              aria-expanded={showAccountMenu} 
              aria-haspopup="true" 
              aria-label="Account menu" 
              className="relative group"
            >
              <Avatar className="w-10 h-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-200">
                <AvatarImage src="" />
                <AvatarFallback className="gradient-primary text-primary-foreground font-semibold text-sm">
                  JD
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-background" />
            </button>

            {showAccountMenu && (
              <div 
                ref={accountMenuRef} 
                role="menu" 
                className="absolute top-full right-0 mt-3 w-72 bg-card rounded-xl border border-border shadow-xl animate-scale-in overflow-hidden"
              >
                {/* User Info Header */}
                <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 ring-2 ring-primary/30">
                      <AvatarImage src="" />
                      <AvatarFallback className="gradient-primary text-primary-foreground font-bold">
                        JD
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">John Doe</div>
                      <div className="text-sm text-muted-foreground truncate">john@company.com</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-success/15 text-success text-xs font-medium rounded-full">
                      <span className="w-1.5 h-1.5 bg-success rounded-full" />
                      Online
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="p-2 border-b border-border/50">
                  <Link
                    to="/settings?section=integrations"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-primary/10 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Puzzle size={16} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Integrations</div>
                        <div className="text-xs text-muted-foreground">Connect your tools</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                  >
                    <User size={16} className="text-muted-foreground" /> 
                    <span>Profile</span>
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                  >
                    <Settings size={16} className="text-muted-foreground" /> 
                    <span>Settings</span>
                  </Link>

                  <Link
                    to="/billing"
                    role="menuitem"
                    onClick={() => onAccountMenuToggle(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                  >
                    <CreditCard size={16} className="text-muted-foreground" /> 
                    <span>Billing</span>
                  </Link>
                </div>

                {/* Sign Out */}
                <div className="p-2 border-t border-border/50">
                  <button
                    role="menuitem"
                    onClick={() => { onLogout(); onAccountMenuToggle(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm w-full"
                  >
                    <LogOut size={16} /> 
                    <span>Sign Out</span>
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
