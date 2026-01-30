import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Settings, CreditCard, LogOut, LayoutDashboard, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <header className="bg-background/95 backdrop-blur-sm border-b border-border/50 px-8 py-5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
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
              <h1 className="text-2xl font-bold gradient-text mb-1">{title}</h1>
              {subtitle && (
                <p className="text-muted-foreground text-sm">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Navigation and User Menu */}
          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 bg-transparent border-none rounded-lg text-muted-foreground text-sm font-medium no-underline cursor-pointer transition-all hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
              <Link
                to="/integrations"
                className="flex items-center gap-2 px-4 py-2 bg-transparent border-none rounded-lg text-muted-foreground text-sm font-medium no-underline cursor-pointer transition-all hover:bg-muted hover:text-foreground"
              >
                <Puzzle size={16} />
                Integrations
              </Link>
            </nav>

            {/* User Menu */}
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
                aria-label="Account menu"
                className="w-10 h-10 rounded-full gradient-primary border-none cursor-pointer flex items-center justify-center"
              >
                <User size={18} className="text-primary-foreground" />
              </button>

              {showUserMenu && (
                <div
                  ref={menuRef}
                  role="menu"
                  className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-border">
                    <div className="font-semibold text-foreground">John Doe</div>
                    <div className="text-sm text-muted-foreground">john@company.com</div>
                  </div>

                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-foreground text-sm no-underline cursor-pointer hover:bg-muted transition-colors"
                  >
                    <User size={16} /> Profile
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-foreground text-sm no-underline cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Settings size={16} /> Settings
                  </Link>

                  <Link
                    to="/billing"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-foreground text-sm no-underline cursor-pointer hover:bg-muted transition-colors"
                  >
                    <CreditCard size={16} /> Billing
                  </Link>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      alert('Logging out...');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-t border-border text-left text-destructive text-sm cursor-pointer hover:bg-muted transition-colors"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8">{children}</main>
    </div>
  );
};

export default PageLayout;
