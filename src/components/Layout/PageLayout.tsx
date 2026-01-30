import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Settings, CreditCard, LogOut, LayoutDashboard, Puzzle } from 'lucide-react';
import { theme } from '../../styles/theme';

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
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: theme.colors.headerBg,
          borderBottom: theme.colors.headerBorder,
          padding: `1.25rem ${theme.spacing['3xl']}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xl }}>
            {showBackButton && (
              <button
                onClick={() => navigate('/')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  background: 'transparent',
                  border: `1px solid ${theme.colors.mutedBorder}`,
                  borderRadius: theme.borderRadius.lg,
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSize.base,
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.normal}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.colors.dark;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <ArrowLeft size={16} />
                Dashboard
              </button>
            )}
            <div>
              <h1
                style={{
                  fontSize: theme.fontSize['4xl'],
                  fontWeight: theme.fontWeight.bold,
                  background: theme.colors.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: theme.spacing.xs,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.base }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Navigation and User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg }}>
            <nav style={{ display: 'flex', gap: theme.spacing.sm }}>
              <Link
                to="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: theme.borderRadius.lg,
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSize.base,
                  fontWeight: theme.fontWeight.medium,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.normal}`,
                }}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
              <Link
                to="/integrations"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: theme.borderRadius.lg,
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSize.base,
                  fontWeight: theme.fontWeight.medium,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.normal}`,
                }}
              >
                <Puzzle size={16} />
                Integrations
              </Link>
            </nav>

            {/* User Menu */}
            <div style={{ position: 'relative' }}>
              <button
                ref={buttonRef}
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
                aria-label="Account menu"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.gradient,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={18} color={theme.colors.text} />
              </button>

              {showUserMenu && (
                <div
                  ref={menuRef}
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: theme.spacing.sm,
                    width: '220px',
                    background: theme.colors.darkSolid,
                    borderRadius: theme.borderRadius.xl,
                    border: `1px solid ${theme.colors.mutedBorder}`,
                    boxShadow: theme.shadows.dropdown,
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: theme.spacing.lg,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                    }}
                  >
                    <div style={{ fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
                      John Doe
                    </div>
                    <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                      john@company.com
                    </div>
                  </div>

                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.base,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <User size={16} /> Profile
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.base,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Settings size={16} /> Settings
                  </Link>

                  <Link
                    to="/billing"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      color: theme.colors.text,
                      fontSize: theme.fontSize.base,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <CreditCard size={16} /> Billing
                  </Link>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      alert('Logging out...');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      background: 'transparent',
                      border: 'none',
                      borderTop: `1px solid ${theme.colors.mutedBorder}`,
                      textAlign: 'left',
                      color: theme.colors.danger,
                      fontSize: theme.fontSize.base,
                      cursor: 'pointer',
                    }}
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
      <main style={{ padding: theme.spacing['3xl'] }}>{children}</main>
    </div>
  );
};

export default PageLayout;
