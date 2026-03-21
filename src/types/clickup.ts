// ClickUp API response types (what the API returns)

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
}

export interface ClickUpStatus {
  id: string;
  status: string;
  type: string;
  color: string;
  orderindex: number;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  space: { id: string };
  lists: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  folder?: { id: string };
  space: { id: string };
  task_count: number;
  statuses: ClickUpStatus[];
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: { status: string; type: string; color: string };
  priority: {
    id: string;
    priority: string;
    color: string;
    orderindex: string;
  } | null;
  assignees: ClickUpMember[];
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  tags: { name: string; tag_fg: string; tag_bg: string }[];
  custom_fields: ClickUpCustomField[];
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  list: { id: string; name: string };
  folder?: { id: string; name: string };
  space: { id: string };
}

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
  color: string | null;
  profilePicture: string | null;
  role: number;
}

export interface ClickUpTimeEntry {
  id: string;
  task: { id: string; name: string };
  user: { id: number; username: string };
  duration: string; // milliseconds as string
  start: string;
  end: string;
  description: string | null;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

export interface ClickUpDoc {
  id: string;
  name: string;
  workspace_id: string;
}

// Request types

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

// Sync types

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

// Rate limit types

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// Webhook types

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

// OAuth types

export interface ClickUpOAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

// Webhook registration response

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
