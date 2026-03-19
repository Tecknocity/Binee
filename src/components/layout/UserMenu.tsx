'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  LogOut,
  Eye,
  CreditCard,
  Plug,
  User,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  /** Anchor position — menu renders relative to this */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function UserMenu({ open, onClose }: UserMenuProps) {
  const { user, workspace, signOut } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay listener to avoid closing immediately on the click that opened it
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClick);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1.5 w-64 bg-navy-light border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden"
    >
      {/* User info */}
      <div className="px-3.5 py-2.5 border-b border-border/50">
        <p className="text-sm font-medium text-text-primary truncate">
          {user?.display_name || 'User'}
        </p>
        <p className="text-xs text-text-muted truncate mt-0.5">
          {user?.email || ''}
        </p>
      </div>

      {/* Profile */}
      <Link
        href="/settings?tab=profile"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
      >
        <User className="w-4 h-4" />
        <span className="text-sm">Profile</span>
      </Link>

      {/* Settings */}
      <Link
        href="/settings"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
      >
        <Settings className="w-4 h-4" />
        <span className="text-sm">Settings</span>
      </Link>

      {/* Usage / Billing */}
      <Link
        href="/billing"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
      >
        <CreditCard className="w-4 h-4" />
        <span className="text-sm">Billing</span>
        <span className="ml-auto text-xs text-text-muted font-mono">
          {workspace?.credit_balance?.toLocaleString() ?? '---'} credits
        </span>
      </Link>

      {/* Integrations */}
      <Link
        href="/integrations"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
      >
        <Plug className="w-4 h-4" />
        <span className="text-sm">Integrations</span>
      </Link>

      <div className="my-1 border-t border-border/50" />

      {/* Sign out */}
      <button
        onClick={async () => {
          await signOut();
          onClose();
        }}
        className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm">Log out</span>
      </button>
    </div>
  );
}
