import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Settings, CreditCard, LogOut, Puzzle, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = true,
}) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showUserMenu &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showUserMenu) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur-xl sticky top-0 z-50 border-b border-border/40">
        <div className="flex justify-between items-center max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-2 bg-transparent border border-border rounded-lg text-muted-foreground text-sm cursor-pointer transition-all hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft size={16} />
                Dashboard
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold gradient-text tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-muted-foreground text-xs">{subtitle}</p>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-expanded={showUserMenu}
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

            {showUserMenu && (
              <div
                ref={menuRef}
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

                {/* Quick Actions - Integrations */}
                <div className="p-2 border-b border-border/50">
                  <Link
                    to="/settings?section=integrations"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
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
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                  >
                    <User size={16} className="text-muted-foreground" /> 
                    <span>Profile</span>
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                  >
                    <Settings size={16} className="text-muted-foreground" /> 
                    <span>Settings</span>
                  </Link>

                  <Link
                    to="/billing"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
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
                    onClick={() => {
                      setShowUserMenu(false);
                      alert('Logging out...');
                    }}
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
      </header>

      {/* Main Content */}
      <main className="p-6">{children}</main>
    </div>
  );
};

export default PageLayout;
