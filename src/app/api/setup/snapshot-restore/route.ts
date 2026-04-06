import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ClickUpClient } from '@/lib/clickup/client';
import { getExistingStructure } from '@/lib/setup/snapshots';

export const maxDuration = 60;

/**
 * POST /api/setup/snapshot-restore
 *
 * Restores a workspace to a previous snapshot by deleting items
 * that Binee created (items that exist now but were NOT in the snapshot).
 *
 * Returns a summary of what was deleted.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id, snapshot_id } = await request.json() as {
      workspace_id: string;
      snapshot_id: string;
    };

    if (!workspace_id || !snapshot_id) {
      return NextResponse.json({ error: 'Missing workspace_id or snapshot_id' }, { status: 400 });
    }

    // 1. Fetch the snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('workspace_structure_snapshots')
      .select('structure')
      .eq('id', snapshot_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (snapError || !snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    const snapshotStructure = snapshot.structure as {
      spaces: Array<{
        clickup_id: string;
        name: string;
        folders: Array<{
          clickup_id: string;
          name: string;
          lists: Array<{ clickup_id: string; name: string }>;
        }>;
      }>;
    };

    // 2. Fetch current workspace structure
    const currentStructure = await getExistingStructure(workspace_id);
    if (!currentStructure) {
      return NextResponse.json({ error: 'Could not fetch current workspace structure' }, { status: 500 });
    }

    // 3. Build sets of IDs that existed in the snapshot
    const snapshotSpaceIds = new Set(snapshotStructure.spaces.map((s) => s.clickup_id));
    const snapshotFolderIds = new Set(
      snapshotStructure.spaces.flatMap((s) => s.folders.map((f) => f.clickup_id))
    );
    const snapshotListIds = new Set(
      snapshotStructure.spaces.flatMap((s) =>
        s.folders.flatMap((f) => f.lists.map((l) => l.clickup_id))
      )
    );

    // 4. Find items to delete (exist now but NOT in snapshot)
    const client = new ClickUpClient(workspace_id);
    const deleted: { spaces: string[]; folders: string[]; lists: string[] } = {
      spaces: [],
      folders: [],
      lists: [],
    };
    const errors: string[] = [];

    // Delete lists first (most granular), then folders, then spaces
    for (const space of currentStructure.spaces) {
      for (const folder of space.folders) {
        for (const list of folder.lists) {
          if (!snapshotListIds.has(list.clickup_id) && !snapshotFolderIds.has(folder.clickup_id) && !snapshotSpaceIds.has(space.clickup_id)) {
            // Only delete individual lists if their parent folder and space existed in snapshot
            // If the whole space/folder is being deleted, no need to delete lists individually
          }
          if (!snapshotListIds.has(list.clickup_id) && snapshotFolderIds.has(folder.clickup_id)) {
            try {
              await client.deleteList(list.clickup_id);
              deleted.lists.push(list.name);
            } catch (err) {
              errors.push(`Failed to delete list "${list.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        if (!snapshotFolderIds.has(folder.clickup_id) && snapshotSpaceIds.has(space.clickup_id)) {
          // Folder is new, delete it (which deletes its lists too)
          try {
            await client.deleteFolder(folder.clickup_id);
            deleted.folders.push(folder.name);
          } catch (err) {
            errors.push(`Failed to delete folder "${folder.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      if (!snapshotSpaceIds.has(space.clickup_id)) {
        // Entire space is new, delete it (which deletes folders and lists too)
        try {
          await client.deleteSpace(space.clickup_id);
          deleted.spaces.push(space.name);
        } catch (err) {
          errors.push(`Failed to delete space "${space.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      deleted,
      errors,
      summary: `Deleted ${deleted.spaces.length} spaces, ${deleted.folders.length} folders, ${deleted.lists.length} lists`,
    });
  } catch (error) {
    console.error('[POST /api/setup/snapshot-restore] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Restore failed' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/setup/snapshot-restore?workspace_id=xxx
 *
 * Lists available snapshots for a workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const { data: snapshots, error } = await supabase
      .from('workspace_structure_snapshots')
      .select('id, snapshot_type, created_at, created_by, structure')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Summarize each snapshot (don't send full structure to client)
    const summarized = (snapshots || []).map((s) => {
      const structure = s.structure as {
        spaces?: Array<{
          name: string;
          folders?: Array<{
            name: string;
            lists?: Array<{ name: string }>;
          }>;
        }>;
      };
      const spaceCount = structure.spaces?.length || 0;
      const folderCount = structure.spaces?.reduce((acc, sp) => acc + (sp.folders?.length || 0), 0) || 0;
      const listCount = structure.spaces?.reduce(
        (acc, sp) => acc + (sp.folders?.reduce((a, f) => a + (f.lists?.length || 0), 0) || 0), 0
      ) || 0;

      return {
        id: s.id,
        snapshot_type: s.snapshot_type,
        created_at: s.created_at,
        summary: { spaces: spaceCount, folders: folderCount, lists: listCount },
      };
    });

    return NextResponse.json({ snapshots: summarized });
  } catch (error) {
    console.error('[GET /api/setup/snapshot-restore] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list snapshots' },
      { status: 500 },
    );
  }
}
