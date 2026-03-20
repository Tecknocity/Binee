import { createClient } from "@supabase/supabase-js";
import { ClickUpClient } from "@/lib/clickup/client";
import type {
  ClickUpWebhookPayload,
  ClickUpWebhookRegistration,
} from "@/types/clickup";
import {
  upsertCachedTasks,
  upsertCachedLists,
  upsertCachedSpaces,
  upsertCachedTimeEntries,
} from "@/lib/clickup/sync";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Webhook registration
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS = [
  "taskCreated",
  "taskUpdated",
  "taskDeleted",
  "taskStatusUpdated",
  "taskAssigneeUpdated",
  "taskDueDateUpdated",
  "taskPriorityUpdated",
  "taskTimeEstimateUpdated",
  "taskTimeTrackedUpdated",
  "listCreated",
  "listUpdated",
  "listDeleted",
  "spaceCreated",
  "spaceUpdated",
  "spaceDeleted",
  "folderCreated",
  "folderUpdated",
  "folderDeleted",
];

/**
 * Registers a webhook with ClickUp to receive real-time updates.
 * Stores the webhook ID in the workspace record for later management.
 */
export async function registerWebhooks(
  workspaceId: string,
  teamId: string
): Promise<ClickUpWebhookRegistration> {
  const client = new ClickUpClient(workspaceId);
  const endpoint = `${APP_URL}/api/webhooks/clickup`;

  const result = await client.createWebhook(
    teamId,
    endpoint,
    WEBHOOK_EVENTS
  );

  // Store webhook ID in workspace for later cleanup
  const supabase = getSupabaseAdmin();
  await supabase
    .from("workspaces")
    .update({
      clickup_webhook_id: result.id,
      clickup_webhook_endpoint: endpoint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  return result as unknown as ClickUpWebhookRegistration;
}

/**
 * Removes the registered webhook from ClickUp and clears the workspace record.
 */
export async function unregisterWebhooks(
  workspaceId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("clickup_webhook_id")
    .eq("id", workspaceId)
    .single();

  if (workspace?.clickup_webhook_id) {
    try {
      const client = new ClickUpClient(workspaceId);
      await client.deleteWebhook(workspace.clickup_webhook_id);
    } catch (err) {
      console.error("Failed to delete ClickUp webhook:", err);
    }
  }

  await supabase
    .from("workspaces")
    .update({
      clickup_webhook_id: null,
      clickup_webhook_endpoint: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
}

// ---------------------------------------------------------------------------
// Event processing — router
// ---------------------------------------------------------------------------

/**
 * Routes a webhook event to the appropriate handler based on event type.
 */
export async function processWebhookEvent(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const eventType = event.event;

  console.log(
    `[Webhook] Processing event: ${eventType} for workspace: ${workspaceId}`
  );

  switch (eventType) {
    case "taskCreated":
      await handleTaskCreated(event, workspaceId);
      break;
    case "taskUpdated":
    case "taskStatusUpdated":
    case "taskAssigneeUpdated":
    case "taskDueDateUpdated":
    case "taskPriorityUpdated":
    case "taskTimeEstimateUpdated":
    case "taskTimeTrackedUpdated":
      await handleTaskUpdated(event, workspaceId);
      break;
    case "taskDeleted":
      await handleTaskDeleted(event, workspaceId);
      break;
    case "listCreated":
      await handleListCreated(event, workspaceId);
      break;
    case "listUpdated":
      await handleListUpdated(event, workspaceId);
      break;
    case "listDeleted":
      await handleListDeleted(event, workspaceId);
      break;
    case "spaceCreated":
      await handleSpaceCreated(event, workspaceId);
      break;
    case "spaceUpdated":
      await handleSpaceUpdated(event, workspaceId);
      break;
    case "spaceDeleted":
      await handleSpaceDeleted(event, workspaceId);
      break;
    case "folderCreated":
    case "folderUpdated":
    case "folderDeleted":
      // Folders are synced with spaces; trigger a lightweight refresh
      await handleFolderChange(event, workspaceId);
      break;
    default:
      console.warn(`[Webhook] Unhandled event type: ${eventType}`);
  }

  // Update last webhook event timestamp
  const supabase = getSupabaseAdmin();
  await supabase
    .from("workspaces")
    .update({
      clickup_last_webhook_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);
}

// ---------------------------------------------------------------------------
// Task handlers
// ---------------------------------------------------------------------------

async function handleTaskCreated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  try {
    const client = new ClickUpClient(workspaceId);
    const task = await client.getTask(taskId);
    await upsertCachedTasks(workspaceId, [task]);
  } catch (err) {
    console.error(`[Webhook] Failed to handle taskCreated ${taskId}:`, err);
  }
}

async function handleTaskUpdated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  try {
    const client = new ClickUpClient(workspaceId);
    const task = await client.getTask(taskId);
    await upsertCachedTasks(workspaceId, [task]);
  } catch (err) {
    console.error(`[Webhook] Failed to handle taskUpdated ${taskId}:`, err);
  }
}

async function handleTaskDeleted(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("cached_tasks")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("clickup_id", taskId);
  } catch (err) {
    console.error(`[Webhook] Failed to handle taskDeleted ${taskId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// List handlers
// ---------------------------------------------------------------------------

async function handleListCreated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const listId = extractEntityId(event, "list");
  if (!listId) return;

  try {
    // ClickUp API doesn't have a direct getList endpoint, so we re-fetch
    // the space's lists. Extract space ID from the event data.
    const spaceId = extractFieldFromHistory(event, "space_id");
    if (spaceId) {
      const client = new ClickUpClient(workspaceId);
      const folders = await client.getFolders(spaceId);
      const folderLists = folders.flatMap((f) => f.lists ?? []);
      const folderlessLists = await client.getFolderlessLists(spaceId);
      await upsertCachedLists(workspaceId, [
        ...folderLists,
        ...folderlessLists,
      ]);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to handle listCreated ${listId}:`, err);
  }
}

async function handleListUpdated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  // Same approach as listCreated — re-fetch and upsert
  await handleListCreated(event, workspaceId);
}

async function handleListDeleted(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const listId = extractEntityId(event, "list");
  if (!listId) return;

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("cached_lists")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("clickup_id", listId);

    // Also remove tasks belonging to this list
    await supabase
      .from("cached_tasks")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("list_id", listId);
  } catch (err) {
    console.error(`[Webhook] Failed to handle listDeleted ${listId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Space handlers
// ---------------------------------------------------------------------------

async function handleSpaceCreated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("clickup_team_id")
      .eq("id", workspaceId)
      .single();

    if (workspace?.clickup_team_id) {
      const client = new ClickUpClient(workspaceId);
      const spaces = await client.getSpaces(workspace.clickup_team_id);
      await upsertCachedSpaces(workspaceId, spaces);
    }
  } catch (err) {
    console.error("[Webhook] Failed to handle spaceCreated:", err);
  }
}

async function handleSpaceUpdated(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  // Same approach — re-fetch all spaces
  await handleSpaceCreated(event, workspaceId);
}

async function handleSpaceDeleted(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  const spaceId = extractEntityId(event, "space");
  if (!spaceId) return;

  try {
    const supabase = getSupabaseAdmin();

    // Remove space and all nested cached data
    // First get lists belonging to this space so we can remove their tasks
    const { data: spaceLists } = await supabase
      .from("cached_lists")
      .select("clickup_id")
      .eq("workspace_id", workspaceId)
      .eq("space_id", spaceId);

    const spaceListIds = (spaceLists ?? []).map((l: { clickup_id: string }) => l.clickup_id);

    if (spaceListIds.length > 0) {
      await supabase
        .from("cached_tasks")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("list_id", spaceListIds);
    }

    await supabase
      .from("cached_lists")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("space_id", spaceId);

    await supabase
      .from("cached_folders")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("space_id", spaceId);

    await supabase
      .from("cached_spaces")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("clickup_id", spaceId);
  } catch (err) {
    console.error(`[Webhook] Failed to handle spaceDeleted ${spaceId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Folder handler
// ---------------------------------------------------------------------------

async function handleFolderChange(
  event: ClickUpWebhookPayload,
  workspaceId: string
): Promise<void> {
  // Re-fetch all spaces to get updated folder data
  await handleSpaceCreated(event, workspaceId);
}

// ---------------------------------------------------------------------------
// Time tracking handler
// ---------------------------------------------------------------------------

export async function handleTimeTracked(
  workspaceId: string,
  teamId: string
): Promise<void> {
  try {
    const client = new ClickUpClient(workspaceId);
    // Fetch last 24 hours of time entries
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    const entries = await client.getTimeEntries(teamId, startDate, endDate);
    await upsertCachedTimeEntries(workspaceId, entries);
  } catch (err) {
    console.error("[Webhook] Failed to handle time tracking update:", err);
  }
}

// ---------------------------------------------------------------------------
// Webhook health check
// ---------------------------------------------------------------------------

/**
 * Verifies webhook health by checking the last event timestamp.
 * Returns true if a webhook event was received within the expected window.
 */
export async function verifyWebhookHealth(
  workspaceId: string
): Promise<{
  healthy: boolean;
  lastEventAt: string | null;
  webhookId: string | null;
}> {
  const supabase = getSupabaseAdmin();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select(
      "clickup_webhook_id, clickup_last_webhook_at, clickup_team_id"
    )
    .eq("id", workspaceId)
    .single();

  if (!workspace?.clickup_webhook_id) {
    return {
      healthy: false,
      lastEventAt: null,
      webhookId: null,
    };
  }

  const lastEventAt = workspace.clickup_last_webhook_at;

  // Consider healthy if we received an event within the last 24 hours
  // or if the webhook was just registered (no events expected yet)
  let healthy = true;
  if (lastEventAt) {
    const lastEvent = new Date(lastEventAt);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    healthy = lastEvent > twentyFourHoursAgo;
  }

  // Also verify the webhook exists in ClickUp
  if (workspace.clickup_team_id) {
    try {
      const client = new ClickUpClient(workspaceId);
      const { webhooks } = await client.getWebhooks(
        workspace.clickup_team_id
      );
      const exists = webhooks.some(
        (w: Record<string, unknown>) => w.id === workspace.clickup_webhook_id
      );
      if (!exists) {
        healthy = false;
      }
    } catch {
      // If we can't verify, assume it's still okay
    }
  }

  return {
    healthy,
    lastEventAt,
    webhookId: workspace.clickup_webhook_id,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function extractEntityId(
  event: ClickUpWebhookPayload,
  entityType: string
): string | null {
  for (const item of event.history_items) {
    if (item.data && typeof item.data === "object") {
      const id = (item.data as Record<string, unknown>)[`${entityType}_id`];
      if (id && typeof id === "string") return id;
    }
    // The parent_id often contains the entity ID
    if (item.parent_id) return item.parent_id;
  }
  return null;
}

function extractFieldFromHistory(
  event: ClickUpWebhookPayload,
  fieldName: string
): string | null {
  for (const item of event.history_items) {
    if (item.data && typeof item.data === "object") {
      const value = (item.data as Record<string, unknown>)[fieldName];
      if (value && typeof value === "string") return value;
    }
  }
  return null;
}
