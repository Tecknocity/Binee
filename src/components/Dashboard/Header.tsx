import React, { useRef, useEffect, useCallback } from 'react';
import { User, Settings, LogOut } from 'lucide-react';
import { ViewMode } from '../../types/dashboard';
import { theme } from '../../styles/theme';

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
    <header style={{ background: theme.colors.headerBg, borderBottom: theme.colors.headerBorder, padding: `1.75rem ${theme.spacing['3xl']}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: theme.fontSize['5xl'], fontWeight: theme.fontWeight.bold, background: theme.colors.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: theme.spacing.xs }}>
            Business Command Center
          </h1>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.md }}>AI-powered business intelligence</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg }}>
          <button onClick={onMappingClick} style={{ padding: '0.65rem 1.25rem', background: theme.colors.infoLight, border: `1px solid ${theme.colors.infoBorder}`, color: theme.colors.info, borderRadius: theme.borderRadius.xl, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>
            Data Mapping
          </button>
          <button onClick={onRefreshClick} style={{ padding: '0.65rem 1.25rem', background: theme.colors.gradient, border: 'none', color: theme.colors.text, borderRadius: theme.borderRadius.xl, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>
            Refresh Data
          </button>
          <div style={{ display: 'flex', background: theme.colors.dark, borderRadius: theme.borderRadius.xl, padding: '0.35rem' }}>
            <button onClick={() => onViewModeChange('company')} style={{ padding: '0.65rem 1.25rem', background: viewMode === 'company' ? theme.colors.gradient : 'transparent', color: viewMode === 'company' ? theme.colors.text : theme.colors.textSecondary, border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>
              Company View
            </button>
            <button onClick={() => onViewModeChange('binee')} style={{ padding: '0.65rem 1.25rem', background: viewMode === 'binee' ? theme.colors.gradient : 'transparent', color: viewMode === 'binee' ? theme.colors.text : theme.colors.textSecondary, border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>
              Binee View
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button ref={accountButtonRef} onClick={() => onAccountMenuToggle(!showAccountMenu)} aria-expanded={showAccountMenu} aria-haspopup="true" aria-label="Account menu" style={{ width: '44px', height: '44px', borderRadius: theme.borderRadius.full, background: theme.colors.gradient, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} color={theme.colors.text} />
            </button>
            {showAccountMenu && (
              <div ref={accountMenuRef} role="menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: theme.spacing.sm, width: '240px', background: theme.colors.darkSolid, borderRadius: theme.borderRadius.xl, border: `1px solid ${theme.colors.mutedBorder}`, boxShadow: theme.shadows.dropdown, zIndex: 1000 }}>
                <div style={{ padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}` }}>
                  <div style={{ fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>John Doe</div>
                  <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>john@company.com</div>
                </div>
                <button role="menuitem" onClick={() => { onSettingsClick(); onAccountMenuToggle(false); }} style={{ width: '100%', padding: `${theme.spacing.md} ${theme.spacing.lg}`, background: 'transparent', border: 'none', textAlign: 'left', color: theme.colors.text, fontSize: theme.fontSize.base, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <Settings size={16} /> Settings
                </button>
                <button role="menuitem" onClick={() => { onLogout(); onAccountMenuToggle(false); }} style={{ width: '100%', padding: `${theme.spacing.md} ${theme.spacing.lg}`, background: 'transparent', border: 'none', textAlign: 'left', color: theme.colors.danger, fontSize: theme.fontSize.base, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: theme.spacing.md, borderTop: `1px solid ${theme.colors.mutedBorder}` }}>
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
