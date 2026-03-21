// supabase/functions/webhook-clickup/index.ts
// B-029: Supabase Edge Function that receives ClickUp webhook events
// and updates cache tables accordingly.
//
// Processes: task CRUD, status changes, assignee changes, list/space/folder changes.
// Verifies webhook authenticity via workspace lookup + optional signature check.
// Logs all events to webhook_events table for audit/replay.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---------------------------------------------------------------------------
// ClickUp API helper (for fetching fresh data on create/update events)
// ---------------------------------------------------------------------------

const CLICKUP_API = "https://api.clickup.com/api/v2";

async function clickupFetch<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: accessToken },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the webhook is authentic by confirming the webhook_id maps to
 * a known workspace. ClickUp includes webhook_id in every payload which
 * we match against our stored registrations.
 *
 * Additionally, if a CLICKUP_WEBHOOK_SECRET is configured, we verify the
 * X-Signature header using HMAC-SHA256 to prevent spoofed payloads.
 */
async function verifyWebhook(
  webhookId: string,
  rawBody: string,
  signatureHeader: string | null
): Promise<{ valid: boolean; workspaceId: string | null; accessToken: string | null }> {
  const supabase = getSupabase();

  // Look up workspace by webhook_id
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, clickup_access_token")
    .eq("clickup_webhook_id", webhookId)
    .single();

  if (error || !workspace) {
    return { valid: false, workspaceId: null, accessToken: null };
  }

  // Optional HMAC signature verification
  const secret = Deno.env.get("CLICKUP_WEBHOOK_SECRET");
  if (secret && signatureHeader) {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const expectedSig = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signatureHeader !== expectedSig) {
        console.warn("[webhook-clickup] Signature mismatch — rejecting");
        return { valid: false, workspaceId: null, accessToken: null };
      }
    } catch (err) {
      console.error("[webhook-clickup] Signature verification error:", err);
      // If verification fails, reject the payload
      return { valid: false, workspaceId: null, accessToken: null };
    }
  }

  return {
    valid: true,
    workspaceId: workspace.id,
    accessToken: workspace.clickup_access_token,
  };
}

// ---------------------------------------------------------------------------
// Webhook payload types (inline for Deno edge function isolation)
// ---------------------------------------------------------------------------

interface WebhookPayload {
  event: string;
  webhook_id: string;
  history_items: HistoryItem[];
}

interface HistoryItem {
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
// Entity ID extraction helpers
// ---------------------------------------------------------------------------

function extractEntityId(
  event: WebhookPayload,
  entityType: string
): string | null {
  for (const item of event.history_items) {
    if (item.data && typeof item.data === "object") {
      const id = item.data[`${entityType}_id`];
      if (id && typeof id === "string") return id;
    }
    // parent_id often contains the entity ID
    if (item.parent_id) return item.parent_id;
  }
  return null;
}

function extractFieldFromHistory(
  event: WebhookPayload,
  fieldName: string
): string | null {
  for (const item of event.history_items) {
    if (item.data && typeof item.data === "object") {
      const value = item.data[fieldName];
      if (value && typeof value === "string") return value;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Task handlers
// ---------------------------------------------------------------------------

interface ClickUpTask {
  id: string;
  name: string;
  description: string | null;
  status: { status: string; type: string; color: string };
  priority: { id: string; priority: string; color: string; orderindex: string } | null;
  assignees: Array<{ id: number; username: string; email: string }>;
  tags: unknown[];
  due_date: string | null;
  start_date: string | null;
  time_estimate: number | null;
  time_spent: number | null;
  custom_fields: unknown[];
  list: { id: string; name: string };
}

function mapTaskToRow(task: ClickUpTask, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    clickup_id: task.id,
    list_id: task.list.id,
    name: task.name,
    description: task.description,
    status: task.status.status,
    priority: task.priority?.id ? parseInt(task.priority.id, 10) : null,
    assignees: task.assignees.map((a) => ({
      id: a.id,
      username: a.username,
      email: a.email,
    })),
    tags: task.tags,
    due_date: task.due_date
      ? new Date(parseInt(task.due_date, 10)).toISOString()
      : null,
    start_date: task.start_date
      ? new Date(parseInt(task.start_date, 10)).toISOString()
      : null,
    time_estimate: task.time_estimate,
    time_spent: task.time_spent,
    custom_fields: task.custom_fields,
    synced_at: new Date().toISOString(),
  };
}

async function handleTaskCreated(
  event: WebhookPayload,
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  const task = await clickupFetch<ClickUpTask>(
    `/task/${taskId}`,
    accessToken
  );
  const row = mapTaskToRow(task, workspaceId);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("cached_tasks")
    .upsert(row, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to insert cached task: ${error.message}`);
  }
}

async function handleTaskUpdated(
  event: WebhookPayload,
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  const task = await clickupFetch<ClickUpTask>(
    `/task/${taskId}`,
    accessToken
  );
  const row = mapTaskToRow(task, workspaceId);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("cached_tasks")
    .upsert(row, { onConflict: "workspace_id,clickup_id" });

  if (error) {
    throw new Error(`Failed to update cached task: ${error.message}`);
  }
}

async function handleTaskDeleted(
  event: WebhookPayload,
  workspaceId: string
): Promise<void> {
  const taskId = extractEntityId(event, "task");
  if (!taskId) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("cached_tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("clickup_id", taskId);

  if (error) {
    throw new Error(`Failed to delete cached task: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// List handlers
// ---------------------------------------------------------------------------

async function handleListCreated(
  event: WebhookPayload,
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const spaceId = extractFieldFromHistory(event, "space_id");
  if (!spaceId) return;

  // Re-fetch folders and folderless lists for the space
  const foldersRes = await clickupFetch<{
    folders: Array<{
      id: string;
      name: string;
      lists: Array<{
        id: string;
        name: string;
        task_count: number;
        statuses?: unknown[];
      }>;
    }>;
  }>(`/space/${spaceId}/folder`, accessToken);

  const listsRes = await clickupFetch<{
    lists: Array<{
      id: string;
      name: string;
      task_count: number;
      statuses?: unknown[];
    }>;
  }>(`/space/${spaceId}/list`, accessToken);

  const allLists = [
    ...(foldersRes.folders ?? []).flatMap((f) =>
      (f.lists ?? []).map((l) => ({
        workspace_id: workspaceId,
        clickup_id: l.id,
        space_id: spaceId,
        folder_id: f.id,
        name: l.name,
        task_count: l.task_count,
        status: l.statuses ?? null,
        synced_at: new Date().toISOString(),
      }))
    ),
    ...(listsRes.lists ?? []).map((l) => ({
      workspace_id: workspaceId,
      clickup_id: l.id,
      space_id: spaceId,
      folder_id: null,
      name: l.name,
      task_count: l.task_count,
      status: l.statuses ?? null,
      synced_at: new Date().toISOString(),
    })),
  ];

  if (allLists.length > 0) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("cached_lists")
      .upsert(allLists, { onConflict: "workspace_id,clickup_id" });
    if (error) {
      throw new Error(`Failed to upsert cached lists: ${error.message}`);
    }
  }
}

async function handleListDeleted(
  event: WebhookPayload,
  workspaceId: string
): Promise<void> {
  const listId = extractEntityId(event, "list");
  if (!listId) return;

  const supabase = getSupabase();

  // Remove the list
  await supabase
    .from("cached_lists")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("clickup_id", listId);

  // Remove tasks belonging to this list
  await supabase
    .from("cached_tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("list_id", listId);
}

// ---------------------------------------------------------------------------
// Space handlers
// ---------------------------------------------------------------------------

async function handleSpaceCreatedOrUpdated(
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const supabase = getSupabase();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("clickup_team_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.clickup_team_id) return;

  const spacesRes = await clickupFetch<{
    spaces: Array<{
      id: string;
      name: string;
      private: boolean;
      statuses?: unknown[];
    }>;
  }>(`/team/${workspace.clickup_team_id}/space`, accessToken);

  const rows = (spacesRes.spaces ?? []).map((s) => ({
    workspace_id: workspaceId,
    clickup_id: s.id,
    name: s.name,
    private: s.private,
    status: s.statuses ?? null,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("cached_spaces")
      .upsert(rows, { onConflict: "workspace_id,clickup_id" });
    if (error) {
      throw new Error(`Failed to upsert cached spaces: ${error.message}`);
    }
  }
}

async function handleSpaceDeleted(
  event: WebhookPayload,
  workspaceId: string
): Promise<void> {
  const spaceId = extractEntityId(event, "space");
  if (!spaceId) return;

  const supabase = getSupabase();

  // Get lists for cascade deletion of tasks
  const { data: spaceLists } = await supabase
    .from("cached_lists")
    .select("clickup_id")
    .eq("workspace_id", workspaceId)
    .eq("space_id", spaceId);

  const listIds = (spaceLists ?? []).map(
    (l: { clickup_id: string }) => l.clickup_id
  );

  if (listIds.length > 0) {
    await supabase
      .from("cached_tasks")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("list_id", listIds);
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
}

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------

async function processEvent(
  event: WebhookPayload,
  workspaceId: string,
  accessToken: string
): Promise<void> {
  const eventType = event.event;

  switch (eventType) {
    // Task events
    case "taskCreated":
      await handleTaskCreated(event, workspaceId, accessToken);
      break;

    case "taskUpdated":
    case "taskStatusUpdated":
    case "taskAssigneeUpdated":
    case "taskDueDateUpdated":
    case "taskPriorityUpdated":
    case "taskTimeEstimateUpdated":
    case "taskTimeTrackedUpdated":
      await handleTaskUpdated(event, workspaceId, accessToken);
      break;

    case "taskDeleted":
      await handleTaskDeleted(event, workspaceId);
      break;

    // List events
    case "listCreated":
    case "listUpdated":
      await handleListCreated(event, workspaceId, accessToken);
      break;

    case "listDeleted":
      await handleListDeleted(event, workspaceId);
      break;

    // Space events
    case "spaceCreated":
    case "spaceUpdated":
      await handleSpaceCreatedOrUpdated(workspaceId, accessToken);
      break;

    case "spaceDeleted":
      await handleSpaceDeleted(event, workspaceId);
      break;

    // Folder events — re-fetch spaces to update folder data
    case "folderCreated":
    case "folderUpdated":
    case "folderDeleted":
      await handleSpaceCreatedOrUpdated(workspaceId, accessToken);
      break;

    default:
      console.warn(`[webhook-clickup] Unhandled event type: ${eventType}`);
  }

  // Update last webhook event timestamp
  const supabase = getSupabase();
  await supabase
    .from("workspaces")
    .update({ clickup_last_webhook_at: new Date().toISOString() })
    .eq("id", workspaceId);
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // Read the raw body once for both signature verification and parsing
  const rawBody = await req.text();

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate minimum required fields
  if (!payload.event || !payload.webhook_id) {
    return new Response(
      JSON.stringify({ error: "Invalid payload: missing event or webhook_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify webhook authenticity
  const signatureHeader = req.headers.get("x-signature");
  const { valid, workspaceId, accessToken } = await verifyWebhook(
    payload.webhook_id,
    rawBody,
    signatureHeader
  );

  if (!valid || !workspaceId) {
    console.warn(
      `[webhook-clickup] Unverified webhook: ${payload.webhook_id}`
    );
    // Return 200 to prevent ClickUp from retrying
    return new Response(
      JSON.stringify({ received: true, matched: false }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Log the raw event to webhook_events table
  const { data: insertedEvent, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      workspace_id: workspaceId,
      source: "clickup",
      event_type: payload.event,
      webhook_id: payload.webhook_id,
      payload: payload,
      received_at: now,
      processed: false,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[webhook-clickup] Failed to log event:", insertError);
  }

  // Process the event to update cache tables
  let processError: string | null = null;
  try {
    if (accessToken) {
      await processEvent(payload, workspaceId, accessToken);
    } else {
      // No access token — can still handle delete events (no API call needed)
      const eventType = payload.event;
      if (eventType === "taskDeleted") {
        await handleTaskDeleted(payload, workspaceId);
      } else if (eventType === "listDeleted") {
        await handleListDeleted(payload, workspaceId);
      } else if (eventType === "spaceDeleted") {
        await handleSpaceDeleted(payload, workspaceId);
      } else {
        processError = "No access token available for non-delete event";
        console.warn(`[webhook-clickup] ${processError}`);
      }
    }
  } catch (err) {
    processError =
      err instanceof Error ? err.message : "Unknown processing error";
    console.error(`[webhook-clickup] Processing error:`, err);
  }

  // Mark event as processed (or record error)
  if (insertedEvent?.id) {
    await supabase
      .from("webhook_events")
      .update({
        processed: !processError,
        processed_at: now,
        error: processError,
      })
      .eq("id", insertedEvent.id);
  }

  // Always return 200 to prevent ClickUp retry storms
  return new Response(
    JSON.stringify({
      received: true,
      processed: !processError,
      event: payload.event,
      error: processError ?? undefined,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
