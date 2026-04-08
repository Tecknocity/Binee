// ---------------------------------------------------------------------------
// Workspace Structure Snapshots
// Safety net: captures full workspace structure at key moments.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import type { SetupPlan } from '@/lib/setup/types';

interface SnapshotStructure {
  spaces: Array<{
    clickup_id: string;
    name: string;
    folders: Array<{
      clickup_id: string;
      name: string;
      lists: Array<{
        clickup_id: string;
        name: string;
        task_count: number;
        statuses: unknown;
      }>;
    }>;
    /** Folderless lists that live directly in the space */
    lists?: Array<{
      clickup_id: string;
      name: string;
      task_count: number;
      statuses: unknown;
    }>;
  }>;
  captured_at: string;
}

/**
 * Take a snapshot of the current workspace structure from cached tables.
 * Stores it in workspace_structure_snapshots for future restoration.
 */
export async function takeWorkspaceSnapshot(
  workspaceId: string,
  snapshotType: 'initial_connect' | 'pre_build' | 'manual',
  userId?: string,
  setupPlan?: SetupPlan,
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Fetch current structure from cached tables
    const [spacesRes, foldersRes, listsRes] = await Promise.all([
      adminClient.from('cached_spaces').select('clickup_id, name, raw_data').eq('workspace_id', workspaceId),
      adminClient.from('cached_folders').select('clickup_id, name, space_id, raw_data').eq('workspace_id', workspaceId),
      adminClient.from('cached_lists').select('clickup_id, name, folder_id, space_id, task_count, status, raw_data').eq('workspace_id', workspaceId),
    ]);

    const spaces = spacesRes.data || [];
    const folders = foldersRes.data || [];
    const lists = listsRes.data || [];

    // Build hierarchical structure
    const folderIds = new Set(folders.map((f) => f.clickup_id));

    const structure: SnapshotStructure = {
      spaces: spaces.map((space) => {
        const spaceFolders = folders.filter((f) => f.space_id === space.clickup_id);
        const folderlessLists = lists
          .filter((l) => l.space_id === space.clickup_id && (!l.folder_id || !folderIds.has(l.folder_id)))
          .map((list) => ({
            clickup_id: list.clickup_id,
            name: list.name,
            task_count: list.task_count || 0,
            statuses: list.status,
          }));

        return {
          clickup_id: space.clickup_id,
          name: space.name,
          folders: spaceFolders.map((folder) => ({
            clickup_id: folder.clickup_id,
            name: folder.name,
            lists: lists
              .filter((l) => l.folder_id === folder.clickup_id)
              .map((list) => ({
                clickup_id: list.clickup_id,
                name: list.name,
                task_count: list.task_count || 0,
                statuses: list.status,
              })),
          })),
          ...(folderlessLists.length > 0 ? { lists: folderlessLists } : {}),
        };
      }),
      captured_at: new Date().toISOString(),
    };

    // Insert snapshot
    const { error } = await adminClient.from('workspace_structure_snapshots').insert({
      workspace_id: workspaceId,
      snapshot_type: snapshotType,
      structure,
      created_by: userId || null,
      setup_plan: setupPlan || null,
    });

    if (error) {
      console.error('[snapshots] Failed to save snapshot:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[snapshots] Error taking snapshot:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get the existing workspace structure from cached tables.
 * Returns a simplified view for the Review stage UI.
 */
export async function getExistingStructure(workspaceId: string): Promise<SnapshotStructure | null> {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const [spacesRes, foldersRes, listsRes] = await Promise.all([
      adminClient.from('cached_spaces').select('clickup_id, name').eq('workspace_id', workspaceId),
      adminClient.from('cached_folders').select('clickup_id, name, space_id').eq('workspace_id', workspaceId),
      adminClient.from('cached_lists').select('clickup_id, name, folder_id, space_id, task_count, status').eq('workspace_id', workspaceId),
    ]);

    const spaces = spacesRes.data || [];
    const folders = foldersRes.data || [];
    const lists = listsRes.data || [];

    if (spaces.length === 0) return null;

    // Collect all folder IDs so we can identify folderless lists
    const folderIds = new Set(folders.map((f) => f.clickup_id));

    return {
      spaces: spaces.map((space) => {
        // Folderless lists: belong to this space but have no folder_id or a folder_id not in any folder
        const folderlessLists = lists
          .filter((l) => l.space_id === space.clickup_id && (!l.folder_id || !folderIds.has(l.folder_id)))
          .map((list) => ({
            clickup_id: list.clickup_id,
            name: list.name,
            task_count: list.task_count || 0,
            statuses: list.status,
          }));

        return {
          clickup_id: space.clickup_id,
          name: space.name,
          folders: folders
            .filter((f) => f.space_id === space.clickup_id)
            .map((folder) => ({
              clickup_id: folder.clickup_id,
              name: folder.name,
              lists: lists
                .filter((l) => l.folder_id === folder.clickup_id)
                .map((list) => ({
                  clickup_id: list.clickup_id,
                  name: list.name,
                  task_count: list.task_count || 0,
                  statuses: list.status,
                })),
            })),
          ...(folderlessLists.length > 0 ? { lists: folderlessLists } : {}),
        };
      }),
      captured_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[snapshots] Error fetching existing structure:', err);
    return null;
  }
}
