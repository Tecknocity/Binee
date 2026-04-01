import { ClickUpClient } from '@/lib/clickup/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceAnalysis {
  /** Human-readable report for the AI prompt */
  summary: string;
  /** Structured data for the UI */
  raw: {
    spaces: Array<{
      name: string;
      id: string;
      folders: Array<{
        name: string;
        id: string;
        lists: Array<{ name: string; id: string; taskCount?: number }>;
      }>;
      folderlessLists: Array<{ name: string; id: string }>;
    }>;
    memberCount: number;
    customFieldCount: number;
    totalTasks: number;
    isEmpty: boolean;
  };
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze a ClickUp workspace's current structure.
 * Called after ClickUp connects, before the Describe step.
 */
export async function analyzeWorkspace(
  workspaceId: string,
): Promise<WorkspaceAnalysis> {
  const client = new ClickUpClient(workspaceId);

  // 1. Get teams (workspace = first team in ClickUp v2)
  const teams = await client.getTeams();
  if (teams.length === 0) {
    return emptyAnalysis('No teams found in workspace.');
  }

  const team = teams[0];
  const memberCount = team.members?.length ?? 0;

  // 2. Fetch all spaces
  const spaces = await client.getSpaces(team.id);

  if (spaces.length === 0) {
    return emptyAnalysis(
      `Workspace is empty — no spaces, folders, or lists exist yet. ${memberCount} team member(s).`,
    );
  }

  // 3. Build hierarchy
  let totalTasks = 0;
  let customFieldCount = 0;
  const spaceData: WorkspaceAnalysis['raw']['spaces'] = [];

  for (const space of spaces) {
    const folders = await client.getFolders(space.id);
    const folderlessLists = await client.getFolderlessLists(space.id);

    const folderData = folders.map((folder) => {
      const lists = (folder.lists ?? []).map((list) => {
        const taskCount = typeof list.task_count === 'number' ? list.task_count : 0;
        totalTasks += taskCount;
        return { name: list.name, id: list.id, taskCount };
      });
      return { name: folder.name, id: folder.id, lists };
    });

    const folderlessData = folderlessLists.map((list) => {
      const taskCount = typeof list.task_count === 'number' ? list.task_count : 0;
      totalTasks += taskCount;
      return { name: list.name, id: list.id };
    });

    spaceData.push({
      name: space.name,
      id: space.id,
      folders: folderData,
      folderlessLists: folderlessData,
    });
  }

  // 4. Build human-readable summary
  const spaceDescriptions = spaceData.map((s) => {
    const folderCount = s.folders.length;
    const listCount =
      s.folders.reduce((acc, f) => acc + f.lists.length, 0) + s.folderlessLists.length;
    if (folderCount === 0 && s.folderlessLists.length === 0) {
      return `'${s.name}' (empty)`;
    }
    return `'${s.name}' (${folderCount} folder${folderCount !== 1 ? 's' : ''}, ${listCount} list${listCount !== 1 ? 's' : ''})`;
  });

  const summary = [
    `Current workspace has ${spaces.length} Space${spaces.length !== 1 ? 's' : ''}: ${spaceDescriptions.join(', ')}.`,
    `${memberCount} team member${memberCount !== 1 ? 's' : ''}. ${customFieldCount} custom field${customFieldCount !== 1 ? 's' : ''}. ${totalTasks} active task${totalTasks !== 1 ? 's' : ''}.`,
  ].join(' ');

  return {
    summary,
    raw: {
      spaces: spaceData,
      memberCount,
      customFieldCount,
      totalTasks,
      isEmpty: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyAnalysis(summary: string): WorkspaceAnalysis {
  return {
    summary,
    raw: {
      spaces: [],
      memberCount: 0,
      customFieldCount: 0,
      totalTasks: 0,
      isEmpty: true,
    },
  };
}
