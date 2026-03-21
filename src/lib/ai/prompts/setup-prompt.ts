import type { BineeContext } from '@/types/ai';
import { getModule, getModulesByPrefix } from '@/lib/ai/knowledge-base';
import type { KBModule } from '@/lib/ai/types/knowledge';

// ---------------------------------------------------------------------------
// Setup prompt — loads `setupper` + `clickup-templates-database-*` from KB
// ---------------------------------------------------------------------------

const SETUPPER_MODULE_KEY = 'setupper';
const TEMPLATES_PREFIX = 'clickup-templates-database';

/**
 * Load the setup/onboarding prompt from the knowledge base.
 *
 * Fetches:
 *   - `setupper` module: workspace setup methodology, discovery questions,
 *     hierarchy recommendations, phased approach
 *   - `clickup-templates-database-1`, `clickup-templates-database-2`:
 *     ClickUp workspace templates (spaces, folders, lists, statuses, fields)
 *
 * The templates are split across multiple rows to stay within DB row-size
 * limits — we use a prefix query to fetch all parts.
 */
export async function loadSetupPrompt(context: BineeContext): Promise<string> {
  const [setupperModule, templateModules] = await Promise.all([
    getModule(SETUPPER_MODULE_KEY),
    getModulesByPrefix(TEMPLATES_PREFIX),
  ]);

  const parts: string[] = [];

  // 1. Setupper brain module
  if (setupperModule?.content) {
    parts.push(setupperModule.content);
  } else {
    console.warn(`[setup-prompt] KB module "${SETUPPER_MODULE_KEY}" not found — using fallback`);
    parts.push(FALLBACK_SETUP_PROMPT);
  }

  // 2. ClickUp templates database (split across multiple rows)
  if (templateModules.length > 0) {
    const templatesContent = combineModuleContent(templateModules);
    parts.push(`## CLICKUP TEMPLATES DATABASE\n${templatesContent}`);
  } else {
    console.warn(`[setup-prompt] No template modules found with prefix "${TEMPLATES_PREFIX}"`);
  }

  return parts.join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function combineModuleContent(modules: KBModule[]): string {
  return modules
    .sort((a, b) => a.module_key.localeCompare(b.module_key))
    .map((m) => m.content)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Fallback — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_SETUP_PROMPT = `## SETUP MODE
You are helping the user set up or restructure their ClickUp workspace.

Follow these principles:
1. Ask discovery questions first: team size, department, work types, current pain points.
2. Suggest a workspace structure: Spaces → Folders → Lists hierarchy.
3. Recommend statuses, custom fields, and views for each list.
4. Propose automations and templates where helpful.
5. Break the setup into phases — do not overwhelm the user.
6. After each phase, confirm understanding before proceeding.
7. Provide concrete examples using the user's domain language.`;
