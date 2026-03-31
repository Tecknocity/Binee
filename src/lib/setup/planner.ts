import type Anthropic from '@anthropic-ai/sdk';
import type {
  BusinessProfile,
  SetupPlan,
  SetupPlanValidationResult,
} from './types';

// ---------------------------------------------------------------------------
// Anthropic client (lazy — server-only)
// ---------------------------------------------------------------------------

const SONNET_MODEL_ID = 'claude-sonnet-4-6';
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

/**
 * Generate a ClickUp workspace plan tailored to the user's business.
 */
export async function generateSetupPlan(
  businessProfile: BusinessProfile,
): Promise<SetupPlan> {
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(businessProfile);

  const anthropic = await getAnthropicClient();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const responseText = response.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const plan = parseSetupPlanResponse(responseText);

  const validation = validateSetupPlan(plan);
  if (!validation.valid) {
    console.warn('[planner] Plan validation issues:', validation.errors);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const parts: string[] = [];

  parts.push(`You are Binee, an AI workspace intelligence assistant specializing in ClickUp workspace setup.

Your task is to analyze a business profile and generate a structured ClickUp workspace plan as JSON.

IMPORTANT: Return ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.`);

  parts.push(`## OUTPUT SCHEMA
Return a single JSON object with this exact structure:
{
  "business_type": "string — detected industry/business type",
  "matched_template": "string — which template category was used as the base",
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
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeSetupPlan(parsed);
  } catch {
    console.error('[planner] Failed to parse AI response as JSON');
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

  return {
    name: String(status.name ?? 'Unknown'),
    color: String(status.color ?? '#808080'),
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

        for (const status of list.statuses) {
          if (!/^#[0-9a-fA-F]{6}$/.test(status.color)) {
            errors.push(
              `Status "${status.name}" in list "${list.name}" has invalid color "${status.color}"`,
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
