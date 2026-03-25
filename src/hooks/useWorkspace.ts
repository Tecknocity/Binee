'use client';

import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

/**
 * Hook to access the current workspace context.
 * Must be used within a WorkspaceProvider (which wraps the authenticated app layout).
 *
 * Returns: workspace, workspace_id, plan_tier, credit_balance, members,
 *          membership, loading, error, refetch
 */
export function useWorkspace() {
  return useWorkspaceContext();
}
