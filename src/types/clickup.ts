// ClickUp API response types (what the API returns)
// Separate from database types (src/types/database.ts).
// Used by all PRD-02 files (client, sync, operations, queries, webhooks).

// ---------------------------------------------------------------------------
// Core entity types
// ---------------------------------------------------------------------------

export interface ClickUpTeam {
  id: string;
  name: string;
  members: ClickUpTeamMemberWrapper[];
  plan?: { name: string; tier?: string };
}

export interface ClickUpTeamMemberWrapper {
  user: ClickUpMember;
}

export interface ClickUpSpace {
  id: string;
  name: string;
  color: string | null;
  private: boolean;
  statuses: ClickUpStatus[];
  features?: ClickUpSpaceFeatures;
}

export interface ClickUpSpaceFeatures {
  due_dates?: { enabled: boolean };
  time_tracking?: { enabled: boolean };
  tags?: { enabled: boolean };
  custom_fields?: { enabled: boolean };
  priorities?: { enabled: boolean; priorities: ClickUpPriority[] };
}

export interface ClickUpStatus {
  id: string;
  status: string;
  type: string;
  color: string;
  orderindex: number;
}

export interface ClickUpPriority {
  id: string;
  priority: string;
  color: string;
  orderindex: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  space: { id: string };
  lists: ClickUpList[];
  hidden?: boolean;
  task_count?: number;
}

export interface ClickUpList {
  id: string;
  name: string;
  folder?: { id: string };
  space: { id: string };
  task_count: number;
  statuses: ClickUpStatus[];
  content?: string;
  due_date?: string | null;
  start_date?: string | null;
  priority?: ClickUpPriority | null;
  assignee?: ClickUpMember | null;
}

export interface ClickUpTag {
  name: string;
  tag_fg: string;
  tag_bg: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: { status: string; type: string; color: string };
  priority: ClickUpPriority | null;
  assignees: ClickUpMember[];
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  tags: ClickUpTag[];
  custom_fields: ClickUpCustomField[];
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  list: { id: string; name: string };
  folder?: { id: string; name: string };
  space: { id: string };
  url?: string;
  parent?: string | null;
  watchers?: ClickUpMember[];
  creator?: ClickUpMember;
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
  color: string | null;
  profilePicture: string | null;
  role: number;
  initials?: string;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value: unknown;
  type_config?: Record<string, unknown>;
}

export interface ClickUpTimeEntry {
  id: string;
  task: { id: string; name: string };
  user: { id: number; username: string };
  duration: string; // milliseconds as string
  start: string;
  end: string;
  description: string | null;
  billable?: boolean;
  tags?: ClickUpTag[];
}

export interface ClickUpDoc {
  id: string;
  name: string;
  workspace_id: string;
}

export interface ClickUpComment {
  id: string;
  comment: Array<{ text: string }>;
  comment_text: string;
  user: { id: number; username: string; email: string; profilePicture: string | null };
  date: string;
  resolved: boolean;
  assignee?: ClickUpMember | null;
}

export interface ClickUpChecklist {
  id: string;
  name: string;
  task_id: string;
  orderindex: number;
  resolved: number;
  unresolved: number;
  items: ClickUpChecklistItem[];
}

export interface ClickUpChecklistItem {
  id: string;
  name: string;
  orderindex: number;
  resolved: boolean;
  assignee?: ClickUpMember | null;
  parent?: string | null;
}

export interface ClickUpGoal {
  id: string;
  name: string;
  team_id: string;
  date_created: string;
  start_date: string | null;
  due_date: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  creator: number;
  color: string;
  percent_completed: number;
}

export interface ClickUpView {
  id: string;
  name: string;
  type: 'list' | 'board' | 'calendar' | 'gantt' | 'table' | 'timeline' | 'map' | 'activity';
  parent: { id: string; type: number };
  visibility: string;
  protected: boolean;
  creator: number;
  date_created: string;
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface CreateTaskParams {
  name: string;
  description?: string;
  assignees?: number[];
  due_date?: number; // unix timestamp ms
  start_date?: number;
  priority?: number; // 1=urgent, 2=high, 3=normal, 4=low
  status?: string;
  tags?: string[];
}

export interface UpdateTaskParams {
  name?: string;
  description?: string;
  assignees?: { add?: number[]; rem?: number[] };
  due_date?: number;
  start_date?: number;
  priority?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Sync types
// ---------------------------------------------------------------------------

export interface SyncResult {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
  members: number;
  timeEntries: number;
  errors: string[];
}

export interface SyncProgress {
  phase:
    | "spaces"
    | "folders"
    | "lists"
    | "tasks"
    | "members"
    | "time_entries"
    | "complete";
  current: number;
  total: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Rate limit types
// ---------------------------------------------------------------------------

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// ---------------------------------------------------------------------------
// Webhook types
// ---------------------------------------------------------------------------

export type ClickUpWebhookEventName =
  | "taskCreated"
  | "taskUpdated"
  | "taskDeleted"
  | "taskStatusUpdated"
  | "taskAssigneeUpdated"
  | "taskDueDateUpdated"
  | "taskPriorityUpdated"
  | "taskTimeEstimateUpdated"
  | "taskTimeTrackedUpdated"
  | "taskMoved"
  | "taskCommentPosted"
  | "taskCommentUpdated"
  | "listCreated"
  | "listUpdated"
  | "listDeleted"
  | "folderCreated"
  | "folderUpdated"
  | "folderDeleted"
  | "spaceCreated"
  | "spaceUpdated"
  | "spaceDeleted"
  | "goalCreated"
  | "goalUpdated"
  | "goalDeleted"
  | "keyResultCreated"
  | "keyResultUpdated"
  | "keyResultDeleted";

export interface ClickUpWebhookEvent {
  event: ClickUpWebhookEventName;
  webhook_id: string;
  history_items: ClickUpWebhookHistoryItem[];
  task_id?: string;
  team_id?: string;
}

export interface ClickUpWebhookPayload {
  event: string;
  webhook_id: string;
  history_items: ClickUpWebhookHistoryItem[];
}

export interface ClickUpWebhookHistoryItem {
  id: string;
  type: number;
  date: string;
  field: string;
  parent_id: string;
  data: Record<string, unknown>;
  source: string | null;
  user: { id: number; username: string; email: string };
  before: unknown;
  after: unknown;
}

// ---------------------------------------------------------------------------
// OAuth types
// ---------------------------------------------------------------------------

export interface ClickUpOAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

// ---------------------------------------------------------------------------
// Webhook registration response
// ---------------------------------------------------------------------------

export interface ClickUpWebhookRegistration {
  id: string;
  webhook: {
    id: string;
    userid: number;
    team_id: number;
    endpoint: string;
    client_id: string;
    events: string[];
    health: {
      status: string;
      fail_count: number;
    };
  };
}

// ---------------------------------------------------------------------------
// API list response wrappers
// ---------------------------------------------------------------------------

export interface ClickUpSpacesResponse {
  spaces: ClickUpSpace[];
}

export interface ClickUpFoldersResponse {
  folders: ClickUpFolder[];
}

export interface ClickUpListsResponse {
  lists: ClickUpList[];
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTask[];
  last_page: boolean;
}

export interface ClickUpTeamsResponse {
  teams: ClickUpTeam[];
}

export interface ClickUpTimeEntriesResponse {
  data: ClickUpTimeEntry[];
}

export interface ClickUpCommentsResponse {
  comments: ClickUpComment[];
}

export interface ClickUpWebhooksResponse {
  webhooks: ClickUpWebhookRegistration[];
}
