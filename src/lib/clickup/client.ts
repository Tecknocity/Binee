import type {
  ClickUpTeam,
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpMember,
  ClickUpTimeEntry,
  ClickUpDoc,
  ClickUpDocPage,
  ClickUpComment,
  ClickUpGoal,
  ClickUpKeyResult,
  ClickUpTag,
  ClickUpCustomField,
  ClickUpView,
  CreateTaskParams,
  UpdateTaskParams,
  RateLimitStatus,
  TaskTimeInStatus,
} from "@/types/clickup";
import { getAccessToken } from "@/lib/clickup/oauth";
import { refreshTokenIfNeeded, forceRefreshToken } from "@/lib/clickup/token-refresh";
import { getRateLimit, shouldThrottle } from "@/lib/clickup/rate-limits";

const BASE_URL = "https://api.clickup.com/api/v2";
const BASE_URL_V3 = "https://api.clickup.com/api/v3";

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
  private planTier = "free";
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(workspaceId: string, planTier?: string) {
    this.workspaceId = workspaceId;
    if (planTier) {
      this.planTier = planTier;
      this.rateLimitTotal = getRateLimit(planTier);
      this.rateLimitRemaining = this.rateLimitTotal;
    }
  }

  // ---------------------------------------------------------------------------
  // Core request method
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    options: RequestOptions = {},
    baseUrl: string = BASE_URL,
  ): Promise<T> {
    const { method = "GET", body, params } = options;

    // Use token-refresh module (falls back to legacy getAccessToken)
    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(this.workspaceId);
    } catch {
      // Fall back to legacy token retrieval if clickup_connections doesn't exist
      const legacyToken = await getAccessToken(this.workspaceId);
      if (!legacyToken) {
        throw new ClickUpApiError(
          "No valid access token for workspace",
          401
        );
      }
      accessToken = legacyToken;
    }

    // Reset per-minute counter if the window has elapsed
    const now = Date.now();
    if (now - this.windowStart >= 60_000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Wait until the rate-limit window resets if we're close to the cap
    if (shouldThrottle(this.requestCount, this.planTier)) {
      const waitMs = Math.max(0, this.rateLimitResetAt.getTime() - now);
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;

    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, String(val));
      }
    }

    let lastError: Error | null = null;
    let hasRetriedWithFreshToken = false;

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

        // On 401, try a forced token refresh once before giving up
        if (res.status === 401 && !hasRetriedWithFreshToken) {
          hasRetriedWithFreshToken = true;
          try {
            accessToken = await forceRefreshToken(this.workspaceId);
            continue; // Retry the request with the new token
          } catch {
            throw new ClickUpApiError(
              "ClickUp token expired and refresh failed. Please reconnect.",
              401,
              await res.text()
            );
          }
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

  /**
   * Get time spent in each status for a single task.
   * Requires the "Total time in Status" ClickApp to be enabled.
   */
  async getTaskTimeInStatus(taskId: string): Promise<TaskTimeInStatus> {
    return this.request<TaskTimeInStatus>(`/task/${taskId}/time_in_status`);
  }

  /**
   * Get time spent in each status for multiple tasks at once.
   * Requires the "Total time in Status" ClickApp to be enabled.
   * Max ~100 task IDs per request (URL length limit).
   */
  async getBulkTasksTimeInStatus(
    taskIds: string[]
  ): Promise<Record<string, TaskTimeInStatus>> {
    if (taskIds.length === 0) return {};
    const params: Record<string, string> = {};
    taskIds.forEach((id, i) => {
      params[`task_ids[${i}]`] = id;
    });
    return this.request<Record<string, TaskTimeInStatus>>(
      `/task/bulk_time_in_status`,
      { params }
    );
  }

  async getTeamMembers(teamId: string): Promise<ClickUpMember[]> {
    const team = await this.getTeam(teamId);
    return team.members.map((m) => m.user);
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

  async deleteSpace(spaceId: string): Promise<void> {
    await this.request<void>(`/space/${spaceId}`, { method: "DELETE" });
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.request<void>(`/folder/${folderId}`, { method: "DELETE" });
  }

  async deleteList(listId: string): Promise<void> {
    await this.request<void>(`/list/${listId}`, { method: "DELETE" });
  }

  async deleteTag(spaceId: string, tagName: string): Promise<void> {
    await this.request<void>(
      `/space/${spaceId}/tag/${encodeURIComponent(tagName)}`,
      { method: "DELETE" },
    );
  }

  async deleteDoc(docId: string): Promise<void> {
    await this.request<void>(`/doc/${docId}`, { method: "DELETE" });
  }

  async deleteGoal(goalId: string): Promise<void> {
    await this.request<void>(`/goal/${goalId}`, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // Docs
  // ---------------------------------------------------------------------------

  async createDoc(
    workspaceId: string,
    name: string,
    content?: string
  ): Promise<ClickUpDoc> {
    const body: Record<string, unknown> = { name };
    if (content) {
      body.content = content;
    }
    return this.request<ClickUpDoc>(`/team/${workspaceId}/doc`, {
      method: "POST",
      body,
    });
  }

  async searchDocs(
    teamId: string
  ): Promise<ClickUpDoc[]> {
    // Try v3 endpoint first (more reliable across plans), fall back to v2
    try {
      const res = await this.request<{ docs: ClickUpDoc[] }>(
        `/workspaces/${teamId}/docs`,
        { method: "GET" },
        BASE_URL_V3,
      );
      return res.docs ?? [];
    } catch {
      // v3 not available, try v2 endpoint
      try {
        const res = await this.request<{ docs: ClickUpDoc[] }>(
          `/team/${teamId}/doc`
        );
        return res.docs ?? [];
      } catch {
        // Docs search not available on this plan
        return [];
      }
    }
  }

  async getDocPages(docId: string): Promise<ClickUpDocPage[]> {
    const res = await this.request<{ pages: ClickUpDocPage[] }>(
      `/doc/${docId}/page`
    );
    return res.pages ?? [];
  }

  async createDocPage(
    docId: string,
    name: string,
    content?: string,
    workspaceId?: string,
  ): Promise<ClickUpDocPage> {
    // v3 is the current Docs API. Try it first when a workspaceId is available
    // because docs created via POST /v3/workspaces/{wid}/docs cannot always be
    // written to via the legacy v2 /doc/{docId}/page endpoint. Fall back to v2
    // if v3 fails (e.g. plan without v3 Docs access).
    const wid = workspaceId || this.workspaceId;
    if (wid) {
      try {
        const body: Record<string, unknown> = { name };
        if (content) {
          body.content = content;
          body.content_format = "text/md";
        }
        return await this.request<ClickUpDocPage>(
          `/workspaces/${wid}/docs/${docId}/pages`,
          { method: "POST", body },
          BASE_URL_V3,
        );
      } catch {
        // Fall through to v2
      }
    }

    const body: Record<string, unknown> = { name };
    if (content) {
      body.content = content;
    }
    return this.request<ClickUpDocPage>(`/doc/${docId}/page`, {
      method: "POST",
      body,
    });
  }

  async updateDocPage(
    docId: string,
    pageId: string,
    params: { name?: string; content?: string }
  ): Promise<ClickUpDocPage> {
    return this.request<ClickUpDocPage>(`/doc/${docId}/page/${pageId}`, {
      method: "PUT",
      body: params as Record<string, unknown>,
    });
  }

  // ---------------------------------------------------------------------------
  // Goals & Key Results
  // ---------------------------------------------------------------------------

  async getGoals(teamId: string): Promise<ClickUpGoal[]> {
    const res = await this.request<{ goals: ClickUpGoal[] }>(
      `/team/${teamId}/goal`
    );
    return res.goals ?? [];
  }

  async createGoal(
    teamId: string,
    params: {
      name: string;
      due_date: string;
      description?: string;
      multiple_owners?: boolean;
      owners?: number[];
      color?: string;
    }
  ): Promise<ClickUpGoal> {
    const res = await this.request<{ goal: ClickUpGoal }>(
      `/team/${teamId}/goal`,
      {
        method: "POST",
        body: params as unknown as Record<string, unknown>,
      }
    );
    return res.goal;
  }

  async updateGoal(
    goalId: string,
    params: {
      name?: string;
      due_date?: string;
      description?: string;
      color?: string;
    }
  ): Promise<ClickUpGoal> {
    const res = await this.request<{ goal: ClickUpGoal }>(
      `/goal/${goalId}`,
      {
        method: "PUT",
        body: params as unknown as Record<string, unknown>,
      }
    );
    return res.goal;
  }

  async getKeyResults(goalId: string): Promise<ClickUpKeyResult[]> {
    const res = await this.request<{ key_results: ClickUpKeyResult[] }>(
      `/goal/${goalId}/key_result`
    );
    return res.key_results ?? [];
  }

  async createKeyResult(
    goalId: string,
    params: {
      name: string;
      type: string;
      steps_start: number;
      steps_end: number;
      unit?: string;
      owners?: number[];
    }
  ): Promise<ClickUpKeyResult> {
    const res = await this.request<{ key_result: ClickUpKeyResult }>(
      `/goal/${goalId}/key_result`,
      {
        method: "POST",
        body: params as unknown as Record<string, unknown>,
      }
    );
    return res.key_result;
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async getTaskComments(taskId: string): Promise<ClickUpComment[]> {
    const res = await this.request<{ comments: ClickUpComment[] }>(
      `/task/${taskId}/comment`
    );
    return res.comments ?? [];
  }

  async createTaskComment(
    taskId: string,
    commentText: string,
    assigneeId?: number
  ): Promise<ClickUpComment> {
    const body: Record<string, unknown> = { comment_text: commentText };
    if (assigneeId !== undefined) {
      body.assignee = assigneeId;
    }
    return this.request<ClickUpComment>(`/task/${taskId}/comment`, {
      method: "POST",
      body,
    });
  }

  // ---------------------------------------------------------------------------
  // Custom Fields
  // ---------------------------------------------------------------------------

  async getListCustomFields(listId: string): Promise<ClickUpCustomField[]> {
    const res = await this.request<{ fields: ClickUpCustomField[] }>(
      `/list/${listId}/field`
    );
    return res.fields ?? [];
  }

  async setCustomFieldValue(
    taskId: string,
    fieldId: string,
    value: unknown
  ): Promise<void> {
    await this.request(`/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      body: { value } as Record<string, unknown>,
    });
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  async getSpaceTags(spaceId: string): Promise<ClickUpTag[]> {
    const res = await this.request<{ tags: ClickUpTag[] }>(
      `/space/${spaceId}/tag`
    );
    return res.tags ?? [];
  }

  async addTagToTask(taskId: string, tagName: string): Promise<void> {
    await this.request(`/task/${taskId}/tag/${tagName}`, {
      method: "POST",
    });
  }

  async removeTagFromTask(taskId: string, tagName: string): Promise<void> {
    await this.request(`/task/${taskId}/tag/${tagName}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Dependencies & Task Links
  // ---------------------------------------------------------------------------

  async addDependency(
    taskId: string,
    dependsOnTaskId: string
  ): Promise<void> {
    await this.request(`/task/${taskId}/dependency`, {
      method: "POST",
      body: { depends_on: dependsOnTaskId },
    });
  }

  async removeDependency(
    taskId: string,
    dependsOnTaskId: string
  ): Promise<void> {
    await this.request(`/task/${taskId}/dependency`, {
      method: "DELETE",
      body: { depends_on: dependsOnTaskId },
    });
  }

  async addTaskLink(
    taskId: string,
    linksToTaskId: string
  ): Promise<void> {
    await this.request(`/task/${taskId}/link/${linksToTaskId}`, {
      method: "POST",
    });
  }

  async removeTaskLink(
    taskId: string,
    linksToTaskId: string
  ): Promise<void> {
    await this.request(`/task/${taskId}/link/${linksToTaskId}`, {
      method: "DELETE",
    });
  }

  // ---------------------------------------------------------------------------
  // Time Tracking (start/stop/manual)
  // ---------------------------------------------------------------------------

  async startTimeEntry(
    teamId: string,
    taskId: string,
    description?: string
  ): Promise<ClickUpTimeEntry> {
    const body: Record<string, unknown> = { tid: taskId };
    if (description) {
      body.description = description;
    }
    const res = await this.request<{ data: ClickUpTimeEntry }>(
      `/team/${teamId}/time_entries/start`,
      { method: "POST", body }
    );
    return res.data;
  }

  async stopTimeEntry(teamId: string): Promise<ClickUpTimeEntry> {
    const res = await this.request<{ data: ClickUpTimeEntry }>(
      `/team/${teamId}/time_entries/stop`,
      { method: "POST" }
    );
    return res.data;
  }

  async addManualTimeEntry(
    teamId: string,
    taskId: string,
    startMs: number,
    durationMs: number,
    description?: string
  ): Promise<ClickUpTimeEntry> {
    const body: Record<string, unknown> = {
      tid: taskId,
      start: startMs,
      duration: durationMs,
    };
    if (description) {
      body.description = description;
    }
    const res = await this.request<{ data: ClickUpTimeEntry }>(
      `/team/${teamId}/time_entries`,
      { method: "POST", body }
    );
    return res.data;
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  async getTeamViews(teamId: string): Promise<ClickUpView[]> {
    const res = await this.request<{ views: ClickUpView[] }>(
      `/team/${teamId}/view`
    );
    return res.views ?? [];
  }

  async getSpaceViews(spaceId: string): Promise<ClickUpView[]> {
    const res = await this.request<{ views: ClickUpView[] }>(
      `/space/${spaceId}/view`
    );
    return res.views ?? [];
  }

  /**
   * Create a view on a list. ClickUp returns the created view envelope under
   * `view` on success. We pass an empty grouping/sorting/filtering payload so
   * the view shows up with sensible defaults — the executor uses this to seed
   * each list with a baseline set of views (List, Board, Calendar, etc.).
   */
  async createListView(
    listId: string,
    name: string,
    type: string,
  ): Promise<{ id: string; name: string; type: string }> {
    const res = await this.request<{ view: { id: string; name: string; type: string } }>(
      `/list/${listId}/view`,
      {
        method: 'POST',
        body: {
          name,
          type,
          grouping: { field: 'status', dir: 1, collapsed: [], ignore: false },
          divide: { field: null, dir: null, collapsed: [] },
          sorting: { fields: [] },
          filters: { op: 'AND', fields: [], search: '', show_closed: false },
          columns: { fields: [] },
          team_sidebar: { assignees: [], assigned_comments: false, unassigned_tasks: false },
          settings: {
            show_task_locations: false,
            show_subtasks: 3,
            show_subtask_parent_names: false,
            show_closed_subtasks: false,
            show_assignees: true,
            show_images: true,
            collapse_empty_columns: null,
            me_comments: true,
            me_subtasks: true,
            me_checklists: true,
          },
        },
      },
    );
    return res.view;
  }

  // ---------------------------------------------------------------------------
  // Checklists (task subitems, distinct from subtasks)
  // ---------------------------------------------------------------------------

  /**
   * Create a checklist on a task. The checklist is a named group of items
   * (think "Pre-launch QA" with sub-bullets). Use createChecklistItem to add
   * each item.
   */
  async createChecklist(
    taskId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const res = await this.request<{ checklist: { id: string; name: string } }>(
      `/task/${taskId}/checklist`,
      { method: 'POST', body: { name } },
    );
    return res.checklist;
  }

  async createChecklistItem(
    checklistId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const res = await this.request<{ checklist_item: { id: string; name: string } }>(
      `/checklist/${checklistId}/checklist_item`,
      { method: 'POST', body: { name } },
    );
    return res.checklist_item;
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
  // Public HTTP methods
  // ---------------------------------------------------------------------------

  /**
   * Perform a GET request to the ClickUp API.
   * All auth headers, token refresh, rate limiting, and retries are handled
   * automatically.
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.request<T>(path, { method: "GET", params });
  }

  /**
   * Perform a POST request to the ClickUp API.
   */
  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.request<T>(path, { method: "POST", body, params });
  }

  /**
   * Perform a PUT request to the ClickUp API.
   */
  async put<T>(
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.request<T>(path, { method: "PUT", body, params });
  }

  /**
   * Perform a DELETE request to the ClickUp API.
   */
  async delete<T = void>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.request<T>(path, { method: "DELETE", params });
  }

  // ---------------------------------------------------------------------------
  // V3 API methods
  // ---------------------------------------------------------------------------

  /**
   * Perform a POST request to the ClickUp API v3.
   * Used for endpoints only available in v3 (e.g., Docs).
   */
  async postV3<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>(path, { method: "POST", body }, BASE_URL_V3);
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
