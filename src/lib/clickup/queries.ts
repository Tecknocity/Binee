import { ClickUpClient } from "@/lib/clickup/client";
import type {
  ClickUpTeam,
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpMember,
} from "@/types/clickup";

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

export interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedTasks {
  tasks: ClickUpTask[];
  lastPage: boolean;
  page: number;
}

export interface TaskQueryOptions {
  page?: number;
  subtasks?: boolean;
  includeClosed?: boolean;
}

// ---------------------------------------------------------------------------
// Workspace (Team)
// ---------------------------------------------------------------------------

export async function getWorkspace(
  workspaceId: string,
  teamId: string
): Promise<QueryResult<ClickUpTeam>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const team = await client.getTeam(teamId);
    return { success: true, data: team };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getWorkspaces(
  workspaceId: string
): Promise<QueryResult<ClickUpTeam[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const teams = await client.getTeams();
    return { success: true, data: teams };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export async function getSpaces(
  workspaceId: string,
  teamId: string
): Promise<QueryResult<ClickUpSpace[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const spaces = await client.getSpaces(teamId);
    return { success: true, data: spaces };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function getFolders(
  workspaceId: string,
  spaceId: string
): Promise<QueryResult<ClickUpFolder[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const folders = await client.getFolders(spaceId);
    return { success: true, data: folders };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function getLists(
  workspaceId: string,
  folderId: string
): Promise<QueryResult<ClickUpList[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const lists = await client.getLists(folderId);
    return { success: true, data: lists };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getFolderlessLists(
  workspaceId: string,
  spaceId: string
): Promise<QueryResult<ClickUpList[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const lists = await client.getFolderlessLists(spaceId);
    return { success: true, data: lists };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Tasks — paginated
// ---------------------------------------------------------------------------

export async function getTasks(
  workspaceId: string,
  listId: string,
  options: TaskQueryOptions = {}
): Promise<QueryResult<PaginatedTasks>> {
  try {
    const { page = 0, subtasks = true, includeClosed = true } = options;
    const client = new ClickUpClient(workspaceId);
    const result = await client.getTasks(listId, page, subtasks, includeClosed);
    return {
      success: true,
      data: {
        tasks: result.tasks,
        lastPage: result.last_page,
        page,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAllTasks(
  workspaceId: string,
  listId: string
): Promise<QueryResult<ClickUpTask[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const tasks = await client.getAllTasks(listId);
    return { success: true, data: tasks };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Single task
// ---------------------------------------------------------------------------

export async function getTask(
  workspaceId: string,
  taskId: string
): Promise<QueryResult<ClickUpTask>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const task = await client.getTask(taskId);
    return { success: true, data: task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getMembers(
  workspaceId: string,
  teamId: string
): Promise<QueryResult<ClickUpMember[]>> {
  try {
    const client = new ClickUpClient(workspaceId);
    const members = await client.getTeamMembers(teamId);
    return { success: true, data: members };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience: fetch full workspace hierarchy
// ---------------------------------------------------------------------------

export interface WorkspaceHierarchy {
  team: ClickUpTeam;
  spaces: Array<{
    space: ClickUpSpace;
    folders: Array<{
      folder: ClickUpFolder;
      lists: ClickUpList[];
    }>;
    folderlessLists: ClickUpList[];
  }>;
  members: ClickUpMember[];
}

export async function getWorkspaceHierarchy(
  workspaceId: string,
  teamId: string
): Promise<QueryResult<WorkspaceHierarchy>> {
  try {
    const client = new ClickUpClient(workspaceId);

    // Fetch team and spaces in parallel
    const [team, spaces, members] = await Promise.all([
      client.getTeam(teamId),
      client.getSpaces(teamId),
      client.getTeamMembers(teamId),
    ]);

    // For each space, fetch folders and folderless lists in parallel
    const spaceData = await Promise.all(
      spaces.map(async (space) => {
        const [folders, folderlessLists] = await Promise.all([
          client.getFolders(space.id),
          client.getFolderlessLists(space.id),
        ]);

        // For each folder, fetch its lists
        const foldersWithLists = await Promise.all(
          folders.map(async (folder) => {
            const lists = await client.getLists(folder.id);
            return { folder, lists };
          })
        );

        return {
          space,
          folders: foldersWithLists,
          folderlessLists,
        };
      })
    );

    return {
      success: true,
      data: {
        team,
        spaces: spaceData,
        members,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
