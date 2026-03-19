'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { ClickUpConnection } from '@/components/settings/ClickUpConnection';
import { Plug } from 'lucide-react';

export default function ConnectionStatus() {
  const { workspace, membership } = useAuth();
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Plug className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-medium text-text-primary">Integrations</h2>
      </div>

      <ClickUpConnection />

      {!isAdmin && (
        <p className="text-xs text-text-muted">
          Contact a workspace admin to manage integrations.
        </p>
      )}
    </div>
  );
}
