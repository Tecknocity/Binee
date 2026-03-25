'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function Header() {
  const { workspace } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-border/50 bg-navy-dark/50 backdrop-blur-sm flex items-center px-4 lg:px-6">
      {/* Workspace name */}
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
    </header>
  );
}
