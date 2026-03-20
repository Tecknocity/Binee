import { createClient } from "@supabase/supabase-js";
import type {
  ClickUpTeam,
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpMember,
  ClickUpTimeEntry,
  ClickUpDoc,
  CreateTaskParams,
  UpdateTaskParams,
  RateLimitStatus,
} from "@/types/clickup";
import { getAccessToken } from "@/lib/clickup/oauth";

const BASE_URL = "https://api.clickup.com/api/v2";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean>;
}

export class ClickUpApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "ClickUpApiError";
  }
}

export class ClickUpRateLimitError extends ClickUpApiError {
  constructor(
    public retryAfterMs: number,
    response?: unknown
  ) {
    super("Rate limit exceeded", 429, response);
    this.name = "ClickUpRateLimitError";
  }
}

export class ClickUpClient {
  private workspaceId: string;
  private rateLimitRemaining = 100;
  private rateLimitTotal = 100;
  private rateLimitResetAt = new Date();
  private maxRetries = 3;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", body, params } = options;

    const accessToken = await getAccessToken(this.workspaceId);
    if (!accessToken) {
      throw new ClickUpApiError(
        "No valid access token for workspace",
        401
      );
    }

    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, String(val));
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        // Parse rate-limit headers
        const rlRemaining = res.headers.get("X-RateLimit-Remaining");
        const rlLimit = res.headers.get("X-RateLimit-Limit");
        const rlReset = res.headers.get("X-RateLimit-Reset");

        if (rlRemaining !== null) {
          this.rateLimitRemaining = parseInt(rlRemaining, 10);
        }
        if (rlLimit !== null) {
          this.rateLimitTotal = parseInt(rlLimit, 10);
        }
        if (rlReset !== null) {
          this.rateLimitResetAt = new Date(parseInt(rlReset, 10) * 1000);
        }

        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 30000);

          if (attempt < this.maxRetries) {
            await this.sleep(waitMs);
            continue;
          }

          throw new ClickUpRateLimitError(waitMs, await res.text());
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new ClickUpApiError(
            `ClickUp API error: ${res.status} ${res.statusText}`,
            res.status,
            errorBody
          );
        }

        // Some DELETE endpoints return 204 with no body
        if (res.status === 204) {
          return undefined as T;
        }

        return (await res.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on network errors or rate limits, not on 4xx/5xx
        if (
          error instanceof ClickUpApiError &&
          error.statusCode !== 429
        ) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Read methods
  // ---------------------------------------------------------------------------

  async getTeam(teamId: string): Promise<ClickUpTeam> {
    const res = await this.request<{ team: ClickUpTeam }>(
      `/team/${teamId}`
    );
    return res.team;
  }

  async getTeams(): Promise<ClickUpTeam[]> {
    const res = await this.request<{ teams: ClickUpTeam[] }>("/team");
    return res.teams;
  }

  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const res = await this.request<{ spaces: ClickUpSpace[] }>(
      `/team/${teamId}/space`,
      { params: { archived: false } }
    );
    return res.spaces;
  }

  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const res = await this.request<{ folders: ClickUpFolder[] }>(
      `/space/${spaceId}/folder`,
      { params: { archived: false } }
    );
    return res.folders;
  }

  async getLists(folderId: string): Promise<ClickUpList[]> {
    const res = await this.request<{ lists: ClickUpList[] }>(
      `/folder/${folderId}/list`,
      { params: { archived: false } }
    );
    return res.lists;
  }

  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const res = await this.request<{ lists: ClickUpList[] }>(
      `/space/${spaceId}/list`,
      { params: { archived: false } }
    );
    return res.lists;
  }

  async getTasks(
    listId: string,
    page = 0,
    subtasks = true,
    includeClosedTasks = true
  ): Promise<{ tasks: ClickUpTask[]; last_page: boolean }> {
    const res = await this.request<{
      tasks: ClickUpTask[];
      last_page: boolean;
    }>(`/list/${listId}/task`, {
      params: {
        page,
        subtasks,
        include_closed: includeClosedTasks,
        order_by: "updated",
      },
    });
    return res;
  }

  async getAllTasks(listId: string): Promise<ClickUpTask[]> {
    const allTasks: ClickUpTask[] = [];
    let page = 0;
    let lastPage = false;

    while (!lastPage) {
      const result = await this.getTasks(listId, page);
      allTasks.push(...result.tasks);
      lastPage = result.last_page;
      page++;
    }

    return allTasks;
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`);
  }

  async getTeamMembers(teamId: string): Promise<ClickUpMember[]> {
    const team = await this.getTeam(teamId);
    return team.members;
  }

  async getTimeEntries(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ClickUpTimeEntry[]> {
    const res = await this.request<{ data: ClickUpTimeEntry[] }>(
      `/team/${teamId}/time_entries`,
      {
        params: {
          start_date: startDate.getTime().toString(),
          end_date: endDate.getTime().toString(),
        },
      }
    );
    return res.data ?? [];
  }

  // ---------------------------------------------------------------------------
  // Write methods
  // ---------------------------------------------------------------------------

  async createSpace(
    teamId: string,
    name: string,
    options?: { color?: string; isPrivate?: boolean }
  ): Promise<ClickUpSpace> {
    return this.request<ClickUpSpace>(`/team/${teamId}/space`, {
      method: "POST",
      body: {
        name,
        multiple_assignees: true,
        features: {
          due_dates: { enabled: true },
          time_tracking: { enabled: true },
          tags: { enabled: true },
        },
        ...(options?.color ? { color: options.color } : {}),
        ...(options?.isPrivate !== undefined
          ? { private: options.isPrivate }
          : {}),
      },
    });
  }

  async createFolder(
    spaceId: string,
    name: string
  ): Promise<ClickUpFolder> {
    return this.request<ClickUpFolder>(`/space/${spaceId}/folder`, {
      method: "POST",
      body: { name },
    });
  }

  async createList(
    folderId: string,
    name: string
  ): Promise<ClickUpList> {
    return this.request<ClickUpList>(`/folder/${folderId}/list`, {
      method: "POST",
      body: { name },
    });
  }

  async createFolderlessList(
    spaceId: string,
    name: string
  ): Promise<ClickUpList> {
    return this.request<ClickUpList>(`/space/${spaceId}/list`, {
      method: "POST",
      body: { name },
    });
  }

  async createTask(
    listId: string,
    params: CreateTaskParams
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: "POST",
      body: params as unknown as Record<string, unknown>,
    });
  }

  async updateTask(
    taskId: string,
    params: UpdateTaskParams
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: "PUT",
      body: params as unknown as Record<string, unknown>,
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>(`/task/${taskId}`, { method: "DELETE" });
  }

  async createDoc(
    workspaceId: string,
    name: string
  ): Promise<ClickUpDoc> {
    return this.request<ClickUpDoc>(`/team/${workspaceId}/doc`, {
      method: "POST",
      body: { name },
    });
  }

  // ---------------------------------------------------------------------------
  // Webhook management
  // ---------------------------------------------------------------------------

  async createWebhook(
    teamId: string,
    endpoint: string,
    events: string[]
  ): Promise<{ id: string; webhook: Record<string, unknown> }> {
    return this.request(`/team/${teamId}/webhook`, {
      method: "POST",
      body: { endpoint, events },
    });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhook/${webhookId}`, { method: "DELETE" });
  }

  async getWebhooks(
    teamId: string
  ): Promise<{ webhooks: Array<Record<string, unknown>> }> {
    return this.request(`/team/${teamId}/webhook`);
  }

  // ---------------------------------------------------------------------------
  // Rate limit info
  // ---------------------------------------------------------------------------

  getRateLimitStatus(): RateLimitStatus {
    return {
      remaining: this.rateLimitRemaining,
      limit: this.rateLimitTotal,
      resetAt: this.rateLimitResetAt,
    };
  }
}
