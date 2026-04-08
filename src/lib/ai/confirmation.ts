import { createClient } from '@supabase/supabase-js';
import { executeTool } from '@/lib/ai/tool-executor';
import type {
  PendingAction,
  ConfirmActionRequest,
  ConfirmActionResponse,
} from '@/types/ai';

// ---------------------------------------------------------------------------
// B-045 — Confirm-Before-Execute for Write Operations
//
// All ClickUp write operations require user confirmation before executing.
// Deletions are blocked entirely (hard requirement from ClickUp MCP).
// Read-only operations execute immediately without confirmation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trust tiers — categorize operations by risk level
// ---------------------------------------------------------------------------

export type TrustTier = 'low' | 'medium' | 'high';

/** Low risk — safe, additive operations. Eligible for "Always Allow". */
const LOW_RISK_OPERATIONS = new Set([
  'create_task',
  'create_doc',
  'create_doc_page',
  'create_goal',
  'create_key_result',
  'add_task_comment',
  'add_tag_to_task',
  'add_task_link',
]);

/** Medium risk — modify existing data. Eligible for "Always Allow". */
const MEDIUM_RISK_OPERATIONS = new Set([
  'update_task',
  'assign_task',
  'move_task',
  'update_doc_page',
  'update_goal',
  'set_custom_field',
  'remove_tag_from_task',
  'add_dependency',
  'remove_dependency',
  'remove_task_link',
]);

/** High risk — destructive operations. Always require confirmation, never auto-approve. */
const HIGH_RISK_OPERATIONS = new Set<string>([
]);

/**
 * Returns the trust tier for an operation.
 */
export function getOperationTrustTier(toolName: string): TrustTier {
  if (LOW_RISK_OPERATIONS.has(toolName)) return 'low';
  if (MEDIUM_RISK_OPERATIONS.has(toolName)) return 'medium';
  if (HIGH_RISK_OPERATIONS.has(toolName)) return 'high';
  // Unknown write operations default to high risk
  return 'high';
}

/**
 * Returns true if the operation is eligible for "Always Allow".
 * Only low and medium risk operations can be auto-approved.
 */
export function isEligibleForAlwaysAllow(toolName: string): boolean {
  const tier = getOperationTrustTier(toolName);
  return tier === 'low' || tier === 'medium';
}

// ---------------------------------------------------------------------------
// Tool classification
// ---------------------------------------------------------------------------

/** All write tools (union of low + medium risk) */
const WRITE_TOOLS = new Set([
  ...LOW_RISK_OPERATIONS,
  ...MEDIUM_RISK_OPERATIONS,
]);

/** Blocked tools (high risk deletions — never execute) */
const BLOCKED_TOOLS = new Set<string>([
]);

/**
 * Returns true if the tool is a write operation requiring confirmation.
 */
export function isWriteOperation(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

/**
 * Returns true if the tool is a blocked deletion operation.
 */
export function isBlockedOperation(toolName: string): boolean {
  return BLOCKED_TOOLS.has(toolName);
}

/**
 * Returns true if the tool is read-only and can execute immediately.
 */
export function isReadOnlyOperation(toolName: string): boolean {
  return !WRITE_TOOLS.has(toolName) && !BLOCKED_TOOLS.has(toolName);
}

// ---------------------------------------------------------------------------
// Human-readable action descriptions
// ---------------------------------------------------------------------------

interface ActionDescription {
  description: string;
  details: string;
}

/**
 * Generates a human-readable description and diff-like details for a write
 * operation so the user knows exactly what will happen before confirming.
 */
export function describeAction(
  toolName: string,
  toolInput: Record<string, unknown>,
): ActionDescription {
  switch (toolName) {
    case 'create_task':
      return {
        description: `Create new task "${toolInput.name}"`,
        details: formatDetails({
          'Task name': toolInput.name,
          List: toolInput.list_name,
          ...(toolInput.assignee_name ? { Assignee: toolInput.assignee_name } : {}),
          ...(toolInput.priority ? { Priority: priorityLabel(toolInput.priority as number) } : {}),
          ...(toolInput.due_date ? { 'Due date': toolInput.due_date } : {}),
          ...(toolInput.status ? { Status: toolInput.status } : {}),
          ...(toolInput.description ? { Description: truncate(toolInput.description as string, 100) } : {}),
        }),
      };

    case 'update_task':
      return {
        description: `Update task ${toolInput.task_id}`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          ...(toolInput.name ? { 'New name': toolInput.name } : {}),
          ...(toolInput.status ? { Status: `→ ${toolInput.status}` } : {}),
          ...(toolInput.priority ? { Priority: `→ ${priorityLabel(toolInput.priority as number)}` } : {}),
          ...(toolInput.due_date ? { 'Due date': `→ ${toolInput.due_date}` } : {}),
          ...(toolInput.assignee_name ? { Assignee: `→ ${toolInput.assignee_name}` } : {}),
        }),
      };

    case 'assign_task':
      return {
        description: `Assign task to ${toolInput.assignee_name}`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          Assignee: `→ ${toolInput.assignee_name}`,
          ...(toolInput.replace_existing ? { 'Replace existing': 'Yes' } : {}),
        }),
      };

    case 'move_task':
      return {
        description: `Move task to "${toolInput.target_list_name}"`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          'Target list': toolInput.target_list_name,
        }),
      };

    case 'create_doc':
      return {
        description: `Create new document "${toolInput.name}"`,
        details: formatDetails({
          'Document name': toolInput.name,
          ...(toolInput.content ? { Content: truncate(toolInput.content as string, 100) } : {}),
        }),
      };

    case 'create_doc_page':
      return {
        description: `Create page "${toolInput.name}" in document`,
        details: formatDetails({
          'Doc ID': toolInput.doc_id,
          'Page name': toolInput.name,
        }),
      };

    case 'update_doc_page':
      return {
        description: `Update document page`,
        details: formatDetails({
          'Doc ID': toolInput.doc_id,
          'Page ID': toolInput.page_id,
          ...(toolInput.name ? { 'New name': toolInput.name } : {}),
        }),
      };

    case 'create_goal':
      return {
        description: `Create goal "${toolInput.name}"`,
        details: formatDetails({
          'Goal name': toolInput.name,
          'Due date': toolInput.due_date,
          ...(toolInput.description ? { Description: truncate(toolInput.description as string, 100) } : {}),
          ...(toolInput.owner_name ? { Owner: toolInput.owner_name } : {}),
        }),
      };

    case 'update_goal':
      return {
        description: `Update goal ${toolInput.goal_id}`,
        details: formatDetails({
          'Goal ID': toolInput.goal_id,
          ...(toolInput.name ? { 'New name': toolInput.name } : {}),
          ...(toolInput.due_date ? { 'Due date': `${toolInput.due_date}` } : {}),
        }),
      };

    case 'create_key_result':
      return {
        description: `Create key result "${toolInput.name}"`,
        details: formatDetails({
          'Goal ID': toolInput.goal_id,
          'Key result name': toolInput.name,
          Target: `${toolInput.steps_start} - ${toolInput.steps_end}`,
        }),
      };

    case 'add_task_comment':
      return {
        description: `Add comment to task ${toolInput.task_id}`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          Comment: truncate(toolInput.comment_text as string, 100),
          ...(toolInput.assignee_name ? { Assignee: toolInput.assignee_name } : {}),
        }),
      };

    case 'add_tag_to_task':
      return {
        description: `Add tag "${toolInput.tag_name}" to task`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          Tag: toolInput.tag_name,
        }),
      };

    case 'remove_tag_from_task':
      return {
        description: `Remove tag "${toolInput.tag_name}" from task`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          Tag: toolInput.tag_name,
        }),
      };

    case 'set_custom_field':
      return {
        description: `Set custom field on task ${toolInput.task_id}`,
        details: formatDetails({
          'Task ID': toolInput.task_id,
          ...(toolInput.field_name ? { Field: toolInput.field_name } : { 'Field ID': toolInput.field_id }),
          Value: toolInput.value,
        }),
      };

    case 'add_dependency':
      return {
        description: `Add dependency: task ${toolInput.task_id} depends on ${toolInput.depends_on_task_id}`,
        details: formatDetails({
          'Task': toolInput.task_id,
          'Depends on': toolInput.depends_on_task_id,
        }),
      };

    case 'remove_dependency':
      return {
        description: `Remove dependency between tasks`,
        details: formatDetails({
          'Task': toolInput.task_id,
          'Depends on': toolInput.depends_on_task_id,
        }),
      };

    case 'add_task_link':
      return {
        description: `Link task ${toolInput.task_id} to ${toolInput.links_to_task_id}`,
        details: formatDetails({
          'Task': toolInput.task_id,
          'Links to': toolInput.links_to_task_id,
        }),
      };

    case 'remove_task_link':
      return {
        description: `Unlink tasks ${toolInput.task_id} and ${toolInput.links_to_task_id}`,
        details: formatDetails({
          'Task': toolInput.task_id,
          'Linked to': toolInput.links_to_task_id,
        }),
      };

    default:
      return {
        description: `Execute ${toolName}`,
        details: formatDetails(toolInput),
      };
  }
}

// ---------------------------------------------------------------------------
// Pending action storage (database-backed)
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  return createClient(url, serviceKey);
}

/**
 * Creates a pending action record and returns it. The action will be stored
 * in message metadata and persisted to the pending_actions table so it
 * survives page refreshes and can be resolved later.
 */
export async function createPendingAction(
  workspaceId: string,
  conversationId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<PendingAction> {
  const { description, details } = describeAction(toolName, toolInput);

  const pendingAction: PendingAction = {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    tool_name: toolName,
    tool_input: toolInput,
    description,
    details,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Persist to database
  const supabase = getSupabaseAdmin();
  await supabase.from('pending_actions').insert({
    id: pendingAction.id,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    tool_name: toolName,
    tool_input: toolInput,
    description,
    details,
    status: 'pending',
    created_at: pendingAction.created_at,
  });

  return pendingAction;
}

/**
 * Resolves a pending action: executes on confirm, discards on cancel.
 * Returns the result for the chat UI.
 */
export async function resolvePendingAction(
  request: ConfirmActionRequest,
): Promise<ConfirmActionResponse> {
  const supabase = getSupabaseAdmin();

  // Fetch the pending action
  const { data: action, error: fetchError } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('id', request.action_id)
    .eq('workspace_id', request.workspace_id)
    .eq('conversation_id', request.conversation_id)
    .single();

  if (fetchError || !action) {
    return {
      action_id: request.action_id,
      status: 'failed',
      error: 'Pending action not found or already resolved.',
    };
  }

  if (action.status !== 'pending') {
    return {
      action_id: request.action_id,
      status: action.status,
      error: `Action already ${action.status}.`,
    };
  }

  const resolvedAt = new Date().toISOString();

  // Cancel path — mark as cancelled and return
  if (!request.confirmed) {
    await supabase
      .from('pending_actions')
      .update({ status: 'cancelled', resolved_at: resolvedAt })
      .eq('id', request.action_id);

    return {
      action_id: request.action_id,
      status: 'cancelled',
    };
  }

  // Confirm path — execute the tool
  try {
    const result = await executeTool(
      action.tool_name,
      action.tool_input as Record<string, unknown>,
      request.workspace_id,
    );

    const success = result.success !== false;

    await supabase
      .from('pending_actions')
      .update({
        status: success ? 'executed' : 'failed',
        resolved_at: resolvedAt,
        execution_result: result,
        execution_error: success ? null : (result.error as string) ?? null,
      })
      .eq('id', request.action_id);

    return {
      action_id: request.action_id,
      status: success ? 'executed' : 'failed',
      result: success ? result : undefined,
      error: success ? undefined : (result.error as string),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await supabase
      .from('pending_actions')
      .update({
        status: 'failed',
        resolved_at: resolvedAt,
        execution_error: errorMessage,
      })
      .eq('id', request.action_id);

    return {
      action_id: request.action_id,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Returns the tool result to feed back to the AI model when a write operation
 * is intercepted. Instead of the actual result, the model receives a
 * "pending_confirmation" signal so it can inform the user.
 */
export function buildPendingConfirmationResult(
  pendingAction: PendingAction,
): Record<string, unknown> {
  return {
    pending_confirmation: true,
    action_id: pendingAction.id,
    description: pendingAction.description,
    details: pendingAction.details,
    message:
      'This action requires user confirmation before it can be executed. ' +
      'The user will see a confirmation prompt with the action details. ' +
      'Do NOT attempt to execute the action again — wait for the user to confirm or cancel.',
  };
}

/**
 * Returns the tool result when a blocked (deletion) tool is invoked.
 */
export function buildBlockedOperationResult(
  toolName: string,
): Record<string, unknown> {
  return {
    blocked: true,
    success: false,
    error:
      `The operation "${toolName}" is not allowed. ` +
      'Deletion operations are blocked for safety. ' +
      'Please inform the user that this action cannot be performed through Binee.',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDetails(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function priorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: 'Urgent',
    2: 'High',
    3: 'Normal',
    4: 'Low',
  };
  return labels[priority] ?? `Priority ${priority}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}
