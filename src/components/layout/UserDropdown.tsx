import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Settings, CreditCard, LogOut, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAccountPanel } from '@/contexts/AccountPanelContext';

export const UserDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openAccount } = useAccountPanel();

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (open && ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleClickOutside]);

  const handleNavClick = (section: string) => {
    setOpen(false);
    openAccount(section);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative group" aria-label="Account menu">
        <Avatar className="w-9 h-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
          <AvatarFallback className="gradient-primary text-white font-semibold text-sm">AK</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-background" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-card rounded-xl border border-border shadow-xl animate-scale-in overflow-hidden">
          {/* User info */}
          <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Avatar className="w-11 h-11 ring-2 ring-primary/30">
                <AvatarFallback className="gradient-primary text-white font-bold">AK</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">Arman Kazemi</div>
                <div className="text-sm text-muted-foreground truncate">arman@tecknocity.com</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-2">
            <button
              onClick={() => handleNavClick('profile')}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
            >
              <div className="flex items-center gap-3">
                <User size={16} className="text-muted-foreground" />
                <span>Profile</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => handleNavClick('settings')}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
            >
              <div className="flex items-center gap-3">
                <Settings size={16} className="text-muted-foreground" />
                <span>Settings</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => handleNavClick('billing')}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-foreground hover:bg-muted/50 rounded-lg transition-colors text-sm w-full"
            >
              <div className="flex items-center gap-3">
                <CreditCard size={16} className="text-muted-foreground" />
                <span>Billing</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Sign out */}
          <div className="p-2 border-t border-border/50">
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm w-full"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
