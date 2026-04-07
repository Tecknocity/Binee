import type Anthropic from '@anthropic-ai/sdk';
import type {
  BusinessProfile,
  SetupPlan,
  SetupPlanValidationResult,
} from './types';

// ---------------------------------------------------------------------------
// Anthropic client (lazy — server-only)
// ---------------------------------------------------------------------------

const SONNET_MODEL_ID = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

let _anthropic: Anthropic | null = null;

async function getAnthropicClient(): Promise<Anthropic> {
  if (!_anthropic) {
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    _anthropic = new AnthropicSDK({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

// ---------------------------------------------------------------------------
// B-073: Generate a structured workspace plan from a business profile
// ---------------------------------------------------------------------------

interface PlanContext {
  conversationContext?: string;
  previousPlan?: Record<string, unknown>;
  planHistorySummary?: string;
}

/**
 * Generate a ClickUp workspace plan tailored to the user's business.
 */
export async function generateSetupPlan(
  businessProfile: BusinessProfile,
  workspaceAnalysis?: string,
  planContext?: PlanContext,
): Promise<SetupPlan> {
  const systemPrompt = buildSystemPrompt(workspaceAnalysis, planContext);
  const userMessage = buildUserMessage(businessProfile);

  let responseText: string;
  try {
    const anthropic = await getAnthropicClient();
    const response = await anthropic.messages.create({
      model: SONNET_MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    responseText = response.content
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('');
  } catch (err) {
    console.error('[planner] AI call failed:', err);
    console.error('[planner] Business profile:', JSON.stringify(businessProfile));
    throw new Error('Failed to call AI for plan generation.');
  }

  let plan: SetupPlan;
  try {
    plan = parseSetupPlanResponse(responseText);
  } catch (err) {
    console.error('[planner] Parse failed. Raw response:', responseText.slice(0, 500));
    console.error('[planner] Business profile:', JSON.stringify(businessProfile));
    throw err;
  }

  const validation = validateSetupPlan(plan);
  if (!validation.valid) {
    console.warn('[planner] Plan validation issues:', validation.errors);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(workspaceAnalysis?: string, planContext?: PlanContext): string {
  const parts: string[] = [];

  parts.push(`You are Binee, an AI workspace intelligence assistant specializing in ClickUp workspace setup.

Your task is to analyze a business profile and generate a structured ClickUp workspace plan as JSON.

IMPORTANT: Return ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.`);

  // Include conversation context so the planner knows what was discussed
  if (planContext?.conversationContext) {
    parts.push(`## CONVERSATION CONTEXT
The user had the following recent discussion with the AI about their workspace needs. Use this context to tailor the plan to match what was discussed and agreed upon:

${planContext.conversationContext}`);
  }

  // Include previous plan so the planner can refine rather than start from scratch
  if (planContext?.previousPlan) {
    const prev = planContext.previousPlan;
    const spaces = Array.isArray(prev.spaces) ? prev.spaces : [];
    const summary = spaces.map((s: Record<string, unknown>) => {
      const folders = Array.isArray(s.folders) ? s.folders : [];
      return `Space: ${s.name}\n${folders.map((f: Record<string, unknown>) => {
        const lists = Array.isArray(f.lists) ? f.lists : [];
        return `  Folder: ${f.name}\n${lists.map((l: Record<string, unknown>) => `    List: ${l.name}`).join('\n')}`;
      }).join('\n')}`;
    }).join('\n');

    parts.push(`## PREVIOUS PLAN (most recent)
The user has already reviewed this structure and is asking for a new version. Unless they indicated specific changes, generate a plan that closely follows this structure while incorporating any conversation feedback:

${summary}
Reasoning: ${prev.reasoning || 'none provided'}`);
  }

  // Include plan history summary so the planner knows the full evolution
  if (planContext?.planHistorySummary) {
    parts.push(`## PLAN VERSION HISTORY
These are all previously generated plans. The user may reference them by version number:

${planContext.planHistorySummary}`);
  }

  parts.push(`## CURRENT WORKSPACE ANALYSIS
${workspaceAnalysis || 'No workspace data yet. This may be a fresh workspace.'}

If the workspace already has structures, build AROUND them. Do not recreate what already exists. Only add new spaces, folders, and lists that are missing.`);

  parts.push(`## OUTPUT SCHEMA
Return a single JSON object with this exact structure:
{
  "business_type": "string - detected industry/business type",
  "matched_template": "string - which template category was used as the base",
  "spaces": [
    {
      "name": "Space Name",
      "folders": [
        {
          "name": "Folder Name",
          "lists": [
            {
              "name": "List Name",
              "description": "optional description of this list's purpose",
              "statuses": [
                { "name": "Status Name", "color": "#hex", "type": "open|active|done|closed" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "recommended_clickapps": ["Time Tracking", "Custom Fields", ...],
  "reasoning": "1-3 sentences explaining why this structure fits the business"
}

## RULES
- Each space must have at least 1 folder
- Each folder must have at least 1 list
- Each list must have at least 2 statuses: minimum one "open" type and one "done" or "closed" type
- Status colors must be valid hex codes
- Keep structure reasonable: 2-5 spaces for small businesses, up to 7 for larger ones
- Use ClickUp naming conventions from the templates database
- Tailor the structure to the specific business, don't just copy a generic template
- Include statuses that reflect real workflow stages for each list type`);

  return parts.join('\n\n---\n\n');
}

function buildUserMessage(profile: BusinessProfile): string {
  const parts: string[] = [
    `## Business Profile`,
    `**Description:** ${profile.businessDescription}`,
  ];

  if (profile.teamSize) {
    parts.push(`**Team Size:** ${profile.teamSize}`);
  }
  if (profile.departments?.length) {
    parts.push(`**Departments:** ${profile.departments.join(', ')}`);
  }
  if (profile.tools?.length) {
    parts.push(`**Current Tools:** ${profile.tools.join(', ')}`);
  }
  if (profile.workflows?.length) {
    parts.push(`**Key Workflows:** ${profile.workflows.join(', ')}`);
  }
  if (profile.painPoints?.length) {
    parts.push(`**Pain Points:** ${profile.painPoints.join(', ')}`);
  }

  parts.push(
    '\nGenerate a complete ClickUp workspace plan as JSON based on this business profile.',
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseSetupPlanResponse(responseText: string): SetupPlan {
  // Strip markdown code fences if present
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Also try regex extraction as fallback
  if (!jsonStr.startsWith('{')) {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeSetupPlan(parsed);
  } catch {
    console.error('[planner] Failed to parse AI response as JSON. First 300 chars:', jsonStr.slice(0, 300));
    throw new Error(
      'Failed to parse workspace plan from AI response. The AI did not return valid JSON.',
    );
  }
}

function normalizeSetupPlan(parsed: Record<string, unknown>): SetupPlan {
  const spaces = Array.isArray(parsed.spaces) ? parsed.spaces : [];

  return {
    business_type: String(parsed.business_type ?? 'general'),
    matched_template: String(parsed.matched_template ?? 'custom'),
    spaces: spaces.map(normalizeSpace),
    recommended_clickapps: Array.isArray(parsed.recommended_clickapps)
      ? parsed.recommended_clickapps.map(String)
      : [],
    reasoning: String(parsed.reasoning ?? ''),
  };
}

function normalizeSpace(space: Record<string, unknown>): {
  name: string;
  folders: Array<{
    name: string;
    lists: Array<{
      name: string;
      statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
      description?: string;
    }>;
  }>;
} {
  const folders = Array.isArray(space.folders) ? space.folders : [];
  return {
    name: String(space.name ?? 'Unnamed Space'),
    folders: folders.map(normalizeFolder),
  };
}

function normalizeFolder(folder: Record<string, unknown>): {
  name: string;
  lists: Array<{
    name: string;
    statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
    description?: string;
  }>;
} {
  const lists = Array.isArray(folder.lists) ? folder.lists : [];
  return {
    name: String(folder.name ?? 'Unnamed Folder'),
    lists: lists.map(normalizeList),
  };
}

function normalizeList(list: Record<string, unknown>): {
  name: string;
  statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
  description?: string;
} {
  const statuses = Array.isArray(list.statuses) ? list.statuses : [];
  const normalizedStatuses = statuses.map(normalizeStatus);

  const hasOpen = normalizedStatuses.some((s) => s.type === 'open');
  const hasDone = normalizedStatuses.some((s) => s.type === 'done' || s.type === 'closed');

  if (!hasOpen) {
    normalizedStatuses.unshift({ name: 'To Do', color: '#d3d3d3', type: 'open' });
  }
  if (!hasDone) {
    normalizedStatuses.push({ name: 'Complete', color: '#6bc950', type: 'done' });
  }

  return {
    name: String(list.name ?? 'Unnamed List'),
    statuses: normalizedStatuses,
    ...(list.description ? { description: String(list.description) } : {}),
  };
}

function normalizeStatus(status: Record<string, unknown>): {
  name: string;
  color: string;
  type: 'open' | 'active' | 'done' | 'closed';
} {
  const validTypes = new Set(['open', 'active', 'done', 'closed']);
  const rawType = String(status.type ?? 'active');

  // Auto-fix invalid hex colors instead of rejecting the plan
  let color = String(status.color ?? '#808080');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    // Try to salvage: strip extra chars, pad if short
    const hex = color.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    color = hex.length === 6 ? `#${hex}` : '#808080';
  }

  return {
    name: String(status.name ?? 'Unknown'),
    color,
    type: validTypes.has(rawType) ? (rawType as 'open' | 'active' | 'done' | 'closed') : 'active',
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSetupPlan(plan: SetupPlan): SetupPlanValidationResult {
  const errors: string[] = [];

  if (plan.spaces.length === 0) {
    errors.push('Plan must have at least 1 space');
  }

  if (plan.spaces.length > 15) {
    errors.push(`Plan has ${plan.spaces.length} spaces — this seems excessive`);
  }

  for (const space of plan.spaces) {
    if (space.folders.length === 0) {
      errors.push(`Space "${space.name}" must have at least 1 folder`);
    }

    for (const folder of space.folders) {
      if (folder.lists.length === 0) {
        errors.push(`Folder "${folder.name}" in space "${space.name}" must have at least 1 list`);
      }

      for (const list of folder.lists) {
        if (list.statuses.length < 2) {
          errors.push(
            `List "${list.name}" in "${folder.name}" must have at least 2 statuses`,
          );
        }

        const hasOpen = list.statuses.some((s) => s.type === 'open');
        const hasDoneOrClosed = list.statuses.some(
          (s) => s.type === 'done' || s.type === 'closed',
        );

        if (!hasOpen) {
          errors.push(`List "${list.name}" is missing an "open" type status`);
        }
        if (!hasDoneOrClosed) {
          errors.push(`List "${list.name}" is missing a "done" or "closed" type status`);
        }

        // Colors are auto-fixed during normalization, so no hard validation needed here
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
