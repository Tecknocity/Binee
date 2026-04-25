import type Anthropic from '@anthropic-ai/sdk';
import type {
  BusinessProfile,
  SetupPlan,
  SetupPlanValidationResult,
  RecommendedTag,
  RecommendedDoc,
  RecommendedGoal,
  WorkspaceContext,
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
  /**
   * The most recent structure the setupper AI proposed during chat, emitted
   * as JSON between |||STRUCTURE_SNAPSHOT||| delimiters. Used as a strong
   * starting point for the planner. The conversation context is reconciled
   * on top so any later user requests, name changes, or refinements take
   * priority over the snapshot.
   */
  chatStructureSnapshot?: Record<string, unknown>;
  previousPlan?: Record<string, unknown>;
  planHistorySummary?: string;
  /** Template content from the ai_knowledge_base for reference */
  templates?: string;
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

  // Attach compact workspace context for the post-confirm enrichment phase.
  // Derived deterministically from the profile so it stays cheap and reliable
  // regardless of what the planner returned.
  plan.context = deriveWorkspaceContext(businessProfile);

  return plan;
}

// ---------------------------------------------------------------------------
// Workspace context derivation (for enrichment phase)
// ---------------------------------------------------------------------------

export function deriveWorkspaceContext(profile: BusinessProfile): WorkspaceContext {
  const domain = (profile.businessDescription || 'general business').trim().slice(0, 300);

  const goalParts: string[] = [];
  if (profile.painPoints?.length) {
    goalParts.push(`resolve: ${profile.painPoints.slice(0, 3).join('; ')}`);
  }
  if (profile.workflows?.length) {
    goalParts.push(`run: ${profile.workflows.slice(0, 3).join('; ')}`);
  }
  const primaryGoal = goalParts.length
    ? goalParts.join(' | ').slice(0, 400)
    : 'establish an organized workspace for day-to-day operations';

  const shapeParts: string[] = [];
  if (profile.teamSize) shapeParts.push(profile.teamSize);
  if (profile.departments?.length) shapeParts.push(profile.departments.join(', '));
  const teamShape = shapeParts.length ? shapeParts.join(' - ').slice(0, 200) : undefined;

  return { domain, primaryGoal, ...(teamShape ? { teamShape } : {}) };
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(workspaceAnalysis?: string, planContext?: PlanContext): string {
  const parts: string[] = [];

  parts.push(`You are Binee, an AI workspace intelligence assistant specializing in ClickUp workspace setup.

Your task is to analyze a business profile and generate a structured ClickUp workspace plan as JSON.

IMPORTANT: Return ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.`);

  // The chat structure snapshot is the most recent structure the chat AI proposed
  // to the user. Use it as a strong starting point, then reconcile with the full
  // conversation - the user may have requested changes, named specific items, or
  // refined details after this snapshot was emitted.
  if (planContext?.chatStructureSnapshot) {
    const snap = planContext.chatStructureSnapshot;
    const snapJson = JSON.stringify(snap, null, 2);
    parts.push(`## LATEST STRUCTURE FROM CHAT (starting point)

This is the most recent structure the assistant proposed to the user during chat. Use it as your strong starting point, then reconcile it with the full conversation below.

${snapJson}

How to use this:
- Treat it as the latest concrete proposal the user has seen.
- Reconcile it against the conversation: if the user requested changes, named specific lists/folders/statuses/tags/docs, or refined any names after this proposal was made, those updates take priority over the snapshot.
- Preserve user-named items verbatim. Anything the user explicitly named or asked for must appear in the final plan exactly as the user said it.
- Fill in implementation details the snapshot does not specify: hex colors for statuses and tags, recommended_clickapps, business_type, matched_template, doc descriptions, and recommended_goals if relevant.
- POPULATE each space's "purpose" and each list's "purpose" from what the user said in the conversation. Use their own words. Omit if they did not say anything specific about that item.
- POPULATE each list's "taskExamples" array with concrete tasks the user mentioned for that list, verbatim or near-verbatim. Omit the field entirely if the user did not give examples for a list. Never invent clients, numbers, dates, or specifics not in the chat.

The goal: deliver the structure the user actually agreed to, including any later corrections or additions from the conversation. The user should see their own words and choices reflected in the Review stage.`);
  }

  // Include conversation context so the planner knows what was discussed.
  // The conversation is the authoritative record of what the user wants.
  if (planContext?.conversationContext) {
    parts.push(`## CONVERSATION CONTEXT

Full conversation between the user and the assistant. This is the authoritative record of the user's intent. Use it to tailor the plan, capture any specific names the user mentioned, and incorporate any changes the user requested after the latest structure proposal:

${planContext.conversationContext}`);
  }

  // Include previous plan so the planner can refine rather than start from scratch.
  if (planContext?.previousPlan) {
    const prev = planContext.previousPlan;
    const spaces = Array.isArray(prev.spaces) ? prev.spaces : [];
    const summary = spaces.map((s: Record<string, unknown>) => {
      const folders = Array.isArray(s.folders) ? s.folders : [];
      const directLists = Array.isArray(s.lists) ? s.lists : [];
      const directListsStr = directLists.map((l: Record<string, unknown>) => `  List: ${l.name}`).join('\n');
      const foldersStr = folders.map((f: Record<string, unknown>) => {
        const lists = Array.isArray(f.lists) ? f.lists : [];
        return `  Folder: ${f.name}\n${lists.map((l: Record<string, unknown>) => `    List: ${l.name}`).join('\n')}`;
      }).join('\n');
      return `Space: ${s.name}\n${directListsStr}${directListsStr && foldersStr ? '\n' : ''}${foldersStr}`;
    }).join('\n');

    parts.push(`## PREVIOUS PLAN (most recent)
The user has already reviewed this structure and is asking for a new version. Generate a plan that incorporates the latest chat proposal and any feedback in the conversation. Where the conversation indicates specific changes, reflect those changes:

${summary}
Reasoning: ${prev.reasoning || 'none provided'}`);
  }

  // Include plan history summary so the planner knows the full evolution
  if (planContext?.planHistorySummary) {
    parts.push(`## PLAN VERSION HISTORY
These are all previously generated plans. The user may reference them by version number:

${planContext.planHistorySummary}`);
  }

  // Inject template knowledge base so the planner can reference proven structures
  if (planContext?.templates) {
    parts.push(`## TEMPLATE KNOWLEDGE BASE (reference, not rigid blueprints)
Use these templates as reference to inform your structure. Adapt everything to this specific business, team size, and workflows described in the conversation context. The user's described processes take priority over template defaults.

${planContext.templates}`);
  }

  parts.push(`## CURRENT WORKSPACE ANALYSIS
${workspaceAnalysis || 'No workspace data yet. This may be a fresh workspace.'}

If the workspace already has structures, build AROUND them. Do not recreate what already exists. Only add new spaces, folders, and lists that are missing.

## IMPORTANT: STATUS LIMITATIONS
The ClickUp API does NOT support creating or modifying task statuses programmatically. Statuses cannot be set via API when creating spaces or lists.
- For EXISTING spaces that already have statuses configured, new lists will inherit the space's statuses automatically. Still include recommended statuses in the plan so users can see what we suggest, but understand these are for display/guidance only.
- For NEW spaces, statuses included in the plan are RECOMMENDATIONS that the user will configure manually in ClickUp after the build. The user will be guided through this in a post-build step.
- In ClickUp, statuses are inherited: Space statuses cascade to all Folders and Lists within that Space. So recommend statuses that work well across all lists in each space.
- Keep per-list statuses consistent within the same space where possible, since space-level status configuration will cover all lists at once.`);

  parts.push(`## OUTPUT SCHEMA
Return a single JSON object with this exact structure:
{
  "business_type": "string - detected industry/business type",
  "matched_template": "string - which template category was used as the base",
  "spaces": [
    {
      "name": "Space Name",
      "purpose": "1 sentence in the user's own words from the chat about what this space is for. Omit if the user did not say anything specific.",
      "lists": [
        {
          "name": "List Name (directly in space, no folder)",
          "description": "optional one-line description",
          "purpose": "1-2 sentences in the user's own words about what this list is for, pulled from the conversation. Use the user's vocabulary, not generic restatements. Omit if the user did not give specifics.",
          "taskExamples": ["Concrete example tasks the user mentioned for this list, verbatim or near-verbatim. Omit the field entirely if the user did not give examples for this list. Do not invent."],
          "statuses": [
            { "name": "Status Name", "color": "#hex", "type": "open|active|done|closed" }
          ]
        }
      ],
      "folders": [
        {
          "name": "Folder Name (only when needed for sub-grouping)",
          "lists": [
            {
              "name": "List Name",
              "description": "optional description",
              "purpose": "1-2 sentences in the user's own words. Omit if not given.",
              "taskExamples": ["Verbatim example tasks from the user. Omit if none."],
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
  "recommended_tags": [
    { "name": "tag-name", "tag_bg": "#hex", "tag_fg": "#FFFFFF" }
  ],
  "recommended_docs": [
    { "name": "Doc Title", "description": "What this doc is for", "audience": "optional - who reads this", "outline": ["Section 1", "Section 2"] }
  ],
  "recommended_goals": [
    { "name": "Goal Name", "due_date": "2026-06-30", "description": "What this goal tracks", "color": "#hex" }
  ],
  "reasoning": "1-3 sentences explaining why this structure fits the business"
}

## RULES
- STRUCTURE BEST PRACTICE: Prefer a flat hierarchy - lists directly in spaces. Each major business area should be its own Space. A folder should represent a grouping concept distinct from the lists inside it - usually a real thing the work belongs to (a client, a project, a department, a product line, a property, a case) where peer folders share that same grouping meaning. Use folders when the folder's identity is separate from its contents and could naturally hold more work over time. Avoid folders whose only list duplicates the folder's own name or category - those are wrappers with no grouping value, keep the list directly in the space instead. A folder is earned, not assumed.
- Each space must have at least 1 list (directly in the space) or 1 folder (containing lists)
- Each folder must have at least 1 list
- Each list must have at least 2 statuses: minimum one "open" type and one "done" or "closed" type
- Status colors must be valid hex codes
- Scale the structure to the team size and business complexity. Do not over-engineer for small teams or under-build for larger ones.
- Use templates as reference, but tailor everything to this specific business. Never copy a template verbatim.
- Include statuses that reflect real workflow stages for each list type (these are recommendations for manual setup, not auto-created)
- Prefer consistent statuses across lists in the same space, since ClickUp space-level statuses cascade to all lists. Only vary statuses per-list when the workflow genuinely differs.
- Include recommended_tags that match the business type (use lowercase kebab-case names). Include as many as are genuinely useful, not a fixed number.
- Include recommended_docs with starter templates relevant to their workflows. Focus on what will actually help the team. Provide a short "outline" array of section names (3-6 sections) and optionally an "audience" field. DO NOT include a "content" field - doc bodies are generated separately after the user confirms the plan.
- Only include recommended_goals if the business context suggests them (e.g. user mentioned targets, deadlines, quarterly plans). Omit the field entirely if goals are not relevant.
- FILL purpose and taskExamples from the conversation, not from templates. Use the user's own words. If the user did not say anything specific about a list, omit the fields. Never invent client names, project names, numbers, or dates that did not appear in the chat.
- LIST ORGANIZATION PATTERNS: when the user describes work that revolves around a few distinct long-lived entities (e.g. 1-2 retainer clients, 2-3 flagship products, recurring campaigns), consider list-per-entity with the lifecycle stage as a custom field, instead of one shared list with stages as statuses. Shared-list + stages-as-statuses fits when entities are many, short-lived, or interchangeable. Only propose the list-per-entity shape when the conversation clearly supports it; never default to it.`);

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

  parts.push("\nGenerate a complete ClickUp workspace plan as JSON. Reconcile the latest structure from chat (if provided) with the conversation context, and reflect the user's specific names and choices.");

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

  const plan: SetupPlan = {
    business_type: String(parsed.business_type ?? 'general'),
    matched_template: String(parsed.matched_template ?? 'custom'),
    spaces: spaces.map(normalizeSpace),
    recommended_clickapps: Array.isArray(parsed.recommended_clickapps)
      ? parsed.recommended_clickapps.map(String)
      : [],
    reasoning: String(parsed.reasoning ?? ''),
  };

  if (Array.isArray(parsed.recommended_tags) && parsed.recommended_tags.length > 0) {
    plan.recommended_tags = parsed.recommended_tags.map(normalizeTag);
  }

  if (Array.isArray(parsed.recommended_docs) && parsed.recommended_docs.length > 0) {
    plan.recommended_docs = parsed.recommended_docs.map(normalizeDoc);
  }

  if (Array.isArray(parsed.recommended_goals) && parsed.recommended_goals.length > 0) {
    plan.recommended_goals = parsed.recommended_goals.map(normalizeGoal);
  }

  return plan;
}

function normalizeSpace(space: Record<string, unknown>): {
  name: string;
  purpose?: string;
  folders: Array<{
    name: string;
    lists: Array<{
      name: string;
      statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
      description?: string;
      purpose?: string;
      taskExamples?: string[];
    }>;
  }>;
  lists?: Array<{
    name: string;
    statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
    description?: string;
    purpose?: string;
    taskExamples?: string[];
  }>;
} {
  const folders = Array.isArray(space.folders) ? space.folders : [];
  const directLists = Array.isArray(space.lists) ? space.lists : [];
  const purpose = typeof space.purpose === 'string' && space.purpose.trim().length > 0
    ? space.purpose.trim().slice(0, 400)
    : undefined;
  return {
    name: String(space.name ?? 'Unnamed Space'),
    ...(purpose ? { purpose } : {}),
    folders: folders.map(normalizeFolder),
    ...(directLists.length > 0 ? { lists: directLists.map(normalizeList) } : {}),
  };
}

function normalizeFolder(folder: Record<string, unknown>): {
  name: string;
  lists: Array<{
    name: string;
    statuses: Array<{ name: string; color: string; type: 'open' | 'active' | 'done' | 'closed' }>;
    description?: string;
    purpose?: string;
    taskExamples?: string[];
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
  purpose?: string;
  taskExamples?: string[];
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

  const purpose = typeof list.purpose === 'string' && list.purpose.trim().length > 0
    ? list.purpose.trim().slice(0, 600)
    : undefined;

  const rawExamples = Array.isArray(list.taskExamples) ? list.taskExamples : [];
  const taskExamples = rawExamples
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0 && t.length <= 300)
    .slice(0, 8);

  return {
    name: String(list.name ?? 'Unnamed List'),
    statuses: normalizedStatuses,
    ...(list.description ? { description: String(list.description) } : {}),
    ...(purpose ? { purpose } : {}),
    ...(taskExamples.length > 0 ? { taskExamples } : {}),
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

function normalizeTag(tag: Record<string, unknown>): RecommendedTag {
  let tagBg = String(tag.tag_bg ?? '#808080');
  if (!/^#[0-9a-fA-F]{6}$/.test(tagBg)) {
    const hex = tagBg.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    tagBg = hex.length === 6 ? `#${hex}` : '#808080';
  }
  return {
    name: String(tag.name ?? 'tag'),
    tag_bg: tagBg,
    tag_fg: String(tag.tag_fg ?? '#FFFFFF'),
  };
}

function normalizeDoc(doc: Record<string, unknown>): RecommendedDoc {
  const outline = Array.isArray(doc.outline)
    ? doc.outline.map(String).filter((s) => s.trim().length > 0).slice(0, 12)
    : undefined;
  return {
    name: String(doc.name ?? 'Untitled Doc'),
    description: String(doc.description ?? ''),
    ...(doc.audience ? { audience: String(doc.audience) } : {}),
    ...(outline && outline.length > 0 ? { outline } : {}),
    ...(doc.content ? { content: String(doc.content) } : {}),
  };
}

function normalizeGoal(goal: Record<string, unknown>): RecommendedGoal {
  return {
    name: String(goal.name ?? 'Untitled Goal'),
    due_date: String(goal.due_date ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    ...(goal.description ? { description: String(goal.description) } : {}),
    ...(goal.color ? { color: String(goal.color) } : {}),
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

  const validateList = (list: { name: string; statuses: Array<{ type: string }> }, context: string) => {
    if (list.statuses.length < 2) {
      errors.push(`List "${list.name}" in ${context} must have at least 2 statuses`);
    }
    const hasOpen = list.statuses.some((s) => s.type === 'open');
    const hasDoneOrClosed = list.statuses.some((s) => s.type === 'done' || s.type === 'closed');
    if (!hasOpen) errors.push(`List "${list.name}" is missing an "open" type status`);
    if (!hasDoneOrClosed) errors.push(`List "${list.name}" is missing a "done" or "closed" type status`);
  };

  for (const space of plan.spaces) {
    const hasFolders = space.folders.length > 0;
    const hasDirectLists = (space.lists?.length ?? 0) > 0;

    if (!hasFolders && !hasDirectLists) {
      errors.push(`Space "${space.name}" must have at least 1 folder or list`);
    }

    for (const folder of space.folders) {
      if (folder.lists.length === 0) {
        errors.push(`Folder "${folder.name}" in space "${space.name}" must have at least 1 list`);
      }
      for (const list of folder.lists) {
        validateList(list, `"${folder.name}"`);
      }
    }

    if (space.lists) {
      for (const list of space.lists) {
        validateList(list, `space "${space.name}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
