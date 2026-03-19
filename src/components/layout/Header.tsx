'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import UserMenu from '@/components/layout/UserMenu';

export default function Header() {
  const { user, workspace } = useAuth();
  const { credit_balance } = useWorkspaceContext();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.display_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 shrink-0 border-b border-border/50 bg-navy-dark/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6">
      {/* Left: Workspace name */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold text-text-primary truncate">
          {workspace?.name || 'Workspace'}
        </h2>
        {workspace?.plan && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent border border-accent/20">
            {workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)}
          </span>
        )}
      </div>

      {/* Right: Credit balance + User avatar */}
      <div className="flex items-center gap-3">
        {/* Credit balance badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border/50 text-text-secondary">
          <Coins className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-mono font-medium">
            {credit_balance.toLocaleString()}
          </span>
        </div>

        {/* User avatar with dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-accent/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-accent text-xs font-bold">{initials}</span>
              </div>
            )}
          </button>

          <UserMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
        </div>
      </div>
    </header>
  );
}
