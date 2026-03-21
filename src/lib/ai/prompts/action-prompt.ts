import type { BineeContext } from '@/types/ai';
import { getModule } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Action prompt — loads `task-executor` brain module from KB
// ---------------------------------------------------------------------------

const TASK_EXECUTOR_KEY = 'task-executor';

/**
 * Load the action/execution prompt from the knowledge base.
 *
 * Fetches:
 *   - `task-executor` module: action execution patterns, ClickUp API
 *     capabilities, batch operation workflows, confirmation protocols
 *
 * Used for action_request task types — creating, updating, and managing
 * tasks and other ClickUp entities.
 */
export async function loadActionPrompt(context: BineeContext): Promise<string> {
  const mod = await getModule(TASK_EXECUTOR_KEY);

  if (!mod?.content) {
    console.warn(`[action-prompt] KB module "${TASK_EXECUTOR_KEY}" not found — using fallback`);
    return FALLBACK_ACTION_PROMPT;
  }

  return mod.content;
}

// ---------------------------------------------------------------------------
// Fallback — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_ACTION_PROMPT = `## ACTION EXECUTION MODE
You are executing workspace operations on behalf of the user.

Follow these principles:
1. Clearly state what action you intend to perform before executing.
2. For bulk operations, show a preview of affected items and ask for confirmation.
3. Validate that target lists, statuses, and fields exist before proceeding.
4. After execution, summarize what was done and flag any failures.
5. For destructive operations (delete, archive), always require explicit confirmation.
6. Suggest related follow-up actions when appropriate.`;
