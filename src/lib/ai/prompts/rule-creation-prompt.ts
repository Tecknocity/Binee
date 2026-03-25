import type { BineeContext } from '@/types/ai';
import { getModule } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Rule creation prompt — loads `task-executor` brain module from KB
// ---------------------------------------------------------------------------

const TASK_EXECUTOR_KEY = 'task-executor';

/**
 * Load the rule/action creation prompt from the knowledge base.
 *
 * Fetches:
 *   - `task-executor` module: action execution patterns, ClickUp API
 *     capabilities, batch operation workflows, confirmation protocols,
 *     automation rule creation templates
 *
 * Used for action_request task types — creating tasks, updating fields,
 * building automation rules, and executing bulk operations.
 */
export async function loadRuleCreationPrompt(context: BineeContext): Promise<string> {
  const mod = await getModule(TASK_EXECUTOR_KEY);

  if (!mod?.content) {
    console.warn(`[rule-creation-prompt] KB module "${TASK_EXECUTOR_KEY}" not found — using fallback`);
    return FALLBACK_RULE_PROMPT;
  }

  return mod.content;
}

// ---------------------------------------------------------------------------
// Fallback — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_RULE_PROMPT = `## ACTION & RULE CREATION MODE
You are helping the user create actions, automation rules, or execute workspace operations.

Follow these principles:
1. Clearly state what action you intend to perform before executing.
2. For bulk operations, show a preview of what will change and ask for confirmation.
3. When creating automation rules, explain the trigger, condition, and action.
4. Validate that the target lists, statuses, and fields exist before proceeding.
5. After execution, summarize what was done and any items that failed.
6. Suggest related follow-up actions when appropriate.
7. For destructive operations (delete, archive), always require explicit confirmation.`;
