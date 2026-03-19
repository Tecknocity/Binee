'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export interface Permissions {
  role: 'owner' | 'admin' | 'member';
  isAdmin: boolean;
  isOwner: boolean;
  canManageBilling: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canEditWorkspace: boolean;
  canDisconnectClickUp: boolean;
}

/**
 * Centralized permission hook for RBAC.
 * Derives boolean flags from the current user's workspace membership role.
 */
export function usePermissions(): Permissions {
  const { membership } = useAuth();

  const role = (membership?.role ?? 'member') as 'owner' | 'admin' | 'member';
  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';

  return {
    role,
    isAdmin,
    isOwner,
    canManageBilling: isAdmin,
    canInviteMembers: isAdmin,
    canRemoveMembers: isAdmin,
    canEditWorkspace: isAdmin,
    canDisconnectClickUp: isAdmin,
  };
}
