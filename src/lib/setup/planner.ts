import type Anthropic from '@anthropic-ai/sdk';
import type { SetupPlan as LegacySetupPlan } from './session';
import type {
  BusinessProfile,
  SetupPlan,
  SetupPlanValidationResult,
} from './types';
import { generateManualSteps } from './manual-steps';
import { getModule, getModulesByPrefix } from '@/lib/ai/knowledge-base';

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
// KB module keys
// ---------------------------------------------------------------------------

const SETUPPER_MODULE_KEY = 'setupper';
const TEMPLATES_PREFIX = 'clickup-templates-database';

// ---------------------------------------------------------------------------
// B-073: Generate a structured workspace plan from a business profile
// ---------------------------------------------------------------------------

/**
 * Generate a ClickUp workspace plan tailored to the user's business.
 *
 * Flow:
 *   1. Load KB modules (setupper + clickup-templates-database-*)
 *   2. Assemble AI call with KB modules as context
 *   3. Parse AI response into structured SetupPlan
 *   4. Validate output
 */
export async function generateSetupPlan(
  businessProfile: BusinessProfile,
): Promise<SetupPlan> {
  // Step 1 — Load KB modules (NOT hardcoded templates)
  const [setupperModule, templateModules] = await Promise.all([
    getModule(SETUPPER_MODULE_KEY),
    getModulesByPrefix(TEMPLATES_PREFIX),
  ]);

  const setupperContent = setupperModule?.content ?? '';
  const templatesContent = templateModules
    .sort((a, b) => a.module_key.localeCompare(b.module_key))
    .map((m) => m.content)
    .join('\n\n---\n\n');

  if (!setupperContent) {
    console.warn('[planner] setupper KB module not found — AI will rely on general knowledge');
  }
  if (templateModules.length === 0) {
    console.warn('[planner] No template KB modules found — AI will rely on general knowledge');
  }

  // Step 2 — Assemble AI call with KB modules as context
  const systemPrompt = buildSystemPrompt(setupperContent, templatesContent);
  const userMessage = buildUserMessage(businessProfile);

  const anthropic = await getAnthropicClient();
  const response = await anthropic.messages.create({
    model: SONNET_MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Step 3 — Parse AI response into structured SetupPlan
  const responseText = response.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const plan = parseSetupPlanResponse(responseText);

  // Step 4 — Validate output
  const validation = validateSetupPlan(plan);
  if (!validation.valid) {
    console.warn('[planner] Plan validation issues:', validation.errors);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  setupperContent: string,
  templatesContent: string,
): string {
  const parts: string[] = [];

  parts.push(`You are Binee, an AI workspace intelligence assistant specializing in ClickUp workspace setup.

Your task is to analyze a business profile and generate a structured ClickUp workspace plan as JSON.

IMPORTANT: Return ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.`);

  if (setupperContent) {
    parts.push(`## SETUP METHODOLOGY\n${setupperContent}`);
  }

  if (templatesContent) {
    parts.push(`## CLICKUP TEMPLATES DATABASE\nUse these industry-specific templates as reference when building the workspace plan. Match the business to the most relevant template and adapt it.\n\n${templatesContent}`);
  }

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

/**
 * Parse the AI response text into a SetupPlan.
 * Handles JSON extraction from potential markdown code blocks.
 */
function parseSetupPlanResponse(responseText: string): SetupPlan {
  // Try to extract JSON from markdown code blocks first
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

/**
 * Normalize the parsed JSON into a well-typed SetupPlan,
 * filling in defaults for any missing fields.
 */
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

  // Ensure minimum statuses: at least one open and one done
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

/**
 * Validate a setup plan against structural requirements.
 */
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

// ---------------------------------------------------------------------------
// Legacy exports — backward compatibility with existing UI components
// ---------------------------------------------------------------------------

/**
 * Parse an AI response string into the legacy SetupPlan format (session.ts).
 * Used by useSetup hook for the existing UI flow.
 */
export function parseAIResponseToPlan(aiResponse: string): LegacySetupPlan {
  try {
    const parsed = JSON.parse(aiResponse);
    const plan: LegacySetupPlan = {
      spaces: parsed.spaces || [],
      docs: parsed.docs || [],
      manualSteps: [],
    };
    plan.manualSteps = generateManualSteps(plan);
    return plan;
  } catch {
    return generateDefaultPlan('agency');
  }
}

export function generateDefaultPlan(businessType: string): LegacySetupPlan {
  const templates: Record<string, () => LegacySetupPlan> = {
    agency: buildAgencyPlan,
    startup: buildStartupPlan,
    ecommerce: buildEcommercePlan,
    consulting: buildConsultingPlan,
    saas: buildSaaSPlan,
  };

  const builder = templates[businessType] || templates.agency;
  const plan = builder();
  plan.manualSteps = generateManualSteps(plan);
  return plan;
}

// ---------------------------------------------------------------------------
// Legacy template builders (fallback plans)
// ---------------------------------------------------------------------------

function buildAgencyPlan(): LegacySetupPlan {
  return {
    spaces: [
      {
        name: 'Client Projects',
        folders: [
          {
            name: 'Active Clients',
            lists: [
              {
                name: 'Client Onboarding',
                tasks: [
                  { name: 'Send welcome packet', description: 'Introduce the client to your process and team.' },
                  { name: 'Collect brand assets', description: 'Gather logos, fonts, color palettes, and brand guidelines.' },
                  { name: 'Set up project channels', description: 'Create Slack channel and shared drive folder.' },
                  { name: 'Schedule kickoff call', description: 'Coordinate a kickoff meeting with all stakeholders.' },
                ],
              },
              {
                name: 'Campaign Management',
                tasks: [
                  { name: 'Define campaign goals', description: 'Align on KPIs and success metrics.' },
                  { name: 'Create content calendar', description: 'Plan posts, ads, and deliverables on a timeline.' },
                  { name: 'Design ad creatives', description: 'Produce visual assets for campaigns.' },
                  { name: 'Launch campaign', description: 'Go live and begin monitoring performance.' },
                  { name: 'Weekly performance report', description: 'Compile analytics and share with client.' },
                ],
              },
              {
                name: 'Content Production',
                tasks: [
                  { name: 'Blog post draft', description: 'Write initial draft based on approved topic.' },
                  { name: 'Social media graphics', description: 'Create platform-specific visual content.' },
                  { name: 'Video production', description: 'Script, shoot, and edit video content.' },
                  { name: 'Client review & approval', description: 'Submit deliverables for client sign-off.' },
                ],
              },
            ],
          },
          {
            name: 'Completed Projects',
            lists: [
              {
                name: 'Archive',
                tasks: [
                  { name: 'Final deliverables handoff', description: 'Transfer all completed assets to client.' },
                  { name: 'Project retrospective', description: 'Document lessons learned and performance results.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Client Requests',
            tasks: [
              { name: 'Intake new request', description: 'Log and triage incoming client requests.' },
              { name: 'Prioritize request backlog', description: 'Review and rank pending requests.' },
            ],
          },
        ],
      },
      {
        name: 'Internal Operations',
        folders: [
          {
            name: 'Team Management',
            lists: [
              {
                name: 'Hiring Pipeline',
                tasks: [
                  { name: 'Post job listing', description: 'Publish open roles on job boards.' },
                  { name: 'Screen applicants', description: 'Review resumes and portfolios.' },
                  { name: 'Schedule interviews', description: 'Coordinate interview rounds with team.' },
                  { name: 'Send offer letter', description: 'Prepare and deliver offer to selected candidate.' },
                ],
              },
              {
                name: 'Team Meetings',
                tasks: [
                  { name: 'Weekly standup agenda', description: 'Prepare talking points for Monday standup.' },
                  { name: 'Monthly all-hands', description: 'Plan agenda and presentations for team meeting.' },
                  { name: 'Quarterly planning', description: 'Set OKRs and resource plans for next quarter.' },
                ],
              },
            ],
          },
          {
            name: 'Finance',
            lists: [
              {
                name: 'Invoicing',
                tasks: [
                  { name: 'Generate monthly invoices', description: 'Create and send invoices for active retainers.' },
                  { name: 'Follow up on overdue payments', description: 'Send reminders for outstanding invoices.' },
                ],
              },
              {
                name: 'Budget Tracking',
                tasks: [
                  { name: 'Update monthly budget', description: 'Record actuals against planned budget.' },
                  { name: 'Review tool subscriptions', description: 'Audit SaaS tools and cancel unused ones.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Internal Wiki',
            tasks: [
              { name: 'Update SOPs', description: 'Revise standard operating procedures as processes change.' },
              { name: 'Onboarding checklist for new hires', description: 'Ensure new team members have accounts and access.' },
            ],
          },
        ],
      },
      {
        name: 'Business Development',
        folders: [
          {
            name: 'Sales Pipeline',
            lists: [
              {
                name: 'Leads',
                tasks: [
                  { name: 'Research prospect', description: 'Gather information about the potential client.' },
                  { name: 'Send intro email', description: 'Craft and send personalized outreach.' },
                  { name: 'Schedule discovery call', description: 'Book a call to understand their needs.' },
                ],
              },
              {
                name: 'Proposals',
                tasks: [
                  { name: 'Draft proposal', description: 'Create a tailored proposal with scope and pricing.' },
                  { name: 'Internal review', description: 'Have a senior team member review before sending.' },
                  { name: 'Send proposal to client', description: 'Deliver and walk through the proposal.' },
                  { name: 'Follow up', description: 'Check in if no response after 3 business days.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Partnership Opportunities',
            tasks: [
              { name: 'Identify potential partners', description: 'List complementary agencies and vendors.' },
              { name: 'Outreach to partners', description: 'Initiate conversations about collaboration.' },
            ],
          },
        ],
      },
    ],
    docs: [
      { name: 'Agency Playbook', content: 'Standard processes, templates, and guidelines for all team members.' },
      { name: 'Client Onboarding Guide', content: 'Step-by-step instructions for bringing new clients on board.' },
      { name: 'Brand Guidelines Template', content: 'Template for documenting client brand standards.' },
    ],
    manualSteps: [],
  };
}

function buildStartupPlan(): LegacySetupPlan {
  return {
    spaces: [
      {
        name: 'Product',
        folders: [
          {
            name: 'Roadmap',
            lists: [
              {
                name: 'Feature Backlog',
                tasks: [
                  { name: 'User authentication flow', description: 'Implement sign-up, login, password reset.' },
                  { name: 'Dashboard MVP', description: 'Build the core dashboard experience.' },
                  { name: 'API integrations', description: 'Connect third-party services.' },
                ],
              },
              {
                name: 'Sprint Board',
                tasks: [
                  { name: 'Sprint planning', description: 'Select stories for the upcoming sprint.' },
                  { name: 'Daily standup notes', description: 'Track blockers and progress.' },
                ],
              },
            ],
          },
          {
            name: 'Bug Tracking',
            lists: [
              {
                name: 'Open Bugs',
                tasks: [
                  { name: 'Bug report template', description: 'Standardize how bugs are reported.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [],
      },
      {
        name: 'Growth',
        folders: [
          {
            name: 'Marketing',
            lists: [
              {
                name: 'Content Calendar',
                tasks: [
                  { name: 'Write launch blog post', description: 'Announce the product launch.' },
                  { name: 'Social media strategy', description: 'Plan channels and posting cadence.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Metrics & KPIs',
            tasks: [
              { name: 'Define north star metric', description: 'Align team on the primary growth metric.' },
            ],
          },
        ],
      },
    ],
    docs: [
      { name: 'Product Requirements Doc', content: 'Template for feature specifications.' },
      { name: 'Engineering Standards', content: 'Coding conventions and review process.' },
    ],
    manualSteps: [],
  };
}

function buildEcommercePlan(): LegacySetupPlan {
  return {
    spaces: [
      {
        name: 'Store Operations',
        folders: [
          {
            name: 'Inventory',
            lists: [
              {
                name: 'Product Catalog',
                tasks: [
                  { name: 'Add new products', description: 'Upload product details, images, and pricing.' },
                  { name: 'Update stock levels', description: 'Sync inventory counts with warehouse.' },
                ],
              },
            ],
          },
          {
            name: 'Orders & Fulfillment',
            lists: [
              {
                name: 'Order Processing',
                tasks: [
                  { name: 'Process daily orders', description: 'Review and confirm new orders.' },
                  { name: 'Handle returns', description: 'Process return requests and refunds.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Supplier Management',
            tasks: [
              { name: 'Negotiate supplier contracts', description: 'Review terms with key suppliers.' },
            ],
          },
        ],
      },
      {
        name: 'Marketing',
        folders: [
          {
            name: 'Campaigns',
            lists: [
              {
                name: 'Seasonal Promotions',
                tasks: [
                  { name: 'Plan holiday campaign', description: 'Design promotions for upcoming holidays.' },
                  { name: 'Email blast schedule', description: 'Coordinate promotional emails.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [],
      },
    ],
    docs: [
      { name: 'Shipping Policy', content: 'Rates, timelines, and return procedures.' },
      { name: 'Product Photography Guide', content: 'Standards for product images.' },
    ],
    manualSteps: [],
  };
}

function buildConsultingPlan(): LegacySetupPlan {
  return {
    spaces: [
      {
        name: 'Client Engagements',
        folders: [
          {
            name: 'Active Projects',
            lists: [
              {
                name: 'Discovery & Assessment',
                tasks: [
                  { name: 'Stakeholder interviews', description: 'Conduct interviews with key stakeholders.' },
                  { name: 'Current state analysis', description: 'Document existing processes and pain points.' },
                ],
              },
              {
                name: 'Deliverables',
                tasks: [
                  { name: 'Draft recommendations report', description: 'Compile findings into actionable recommendations.' },
                  { name: 'Final presentation', description: 'Prepare and deliver executive presentation.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Proposal Pipeline',
            tasks: [
              { name: 'Draft engagement letter', description: 'Outline scope, timeline, and fees.' },
            ],
          },
        ],
      },
      {
        name: 'Knowledge Base',
        folders: [],
        folderlessLists: [
          {
            name: 'Frameworks & Templates',
            tasks: [
              { name: 'Update SWOT template', description: 'Refresh the SWOT analysis template.' },
              { name: 'Add case study', description: 'Document a recent successful engagement.' },
            ],
          },
        ],
      },
    ],
    docs: [
      { name: 'Consulting Methodology', content: 'Our standard engagement framework.' },
      { name: 'Proposal Template', content: 'Reusable proposal structure.' },
    ],
    manualSteps: [],
  };
}

function buildSaaSPlan(): LegacySetupPlan {
  return {
    spaces: [
      {
        name: 'Engineering',
        folders: [
          {
            name: 'Product Development',
            lists: [
              {
                name: 'Sprint Backlog',
                tasks: [
                  { name: 'Set up CI/CD pipeline', description: 'Automate build, test, and deployment.' },
                  { name: 'Implement user onboarding', description: 'Build the first-run experience.' },
                  { name: 'API rate limiting', description: 'Add rate limits to public endpoints.' },
                ],
              },
              {
                name: 'Tech Debt',
                tasks: [
                  { name: 'Refactor auth module', description: 'Clean up legacy authentication code.' },
                  { name: 'Database indexing', description: 'Add missing indexes for slow queries.' },
                ],
              },
            ],
          },
          {
            name: 'QA',
            lists: [
              {
                name: 'Test Cases',
                tasks: [
                  { name: 'Write integration tests', description: 'Cover critical user flows.' },
                  { name: 'Performance benchmarks', description: 'Establish baseline performance metrics.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [],
      },
      {
        name: 'Customer Success',
        folders: [
          {
            name: 'Support',
            lists: [
              {
                name: 'Ticket Triage',
                tasks: [
                  { name: 'Set up support categories', description: 'Define ticket types and priorities.' },
                  { name: 'Create canned responses', description: 'Draft templates for common questions.' },
                ],
              },
            ],
          },
        ],
        folderlessLists: [
          {
            name: 'Customer Feedback',
            tasks: [
              { name: 'Feature request board', description: 'Track and prioritize customer requests.' },
              { name: 'NPS survey setup', description: 'Configure quarterly NPS surveys.' },
            ],
          },
        ],
      },
    ],
    docs: [
      { name: 'API Documentation', content: 'Endpoint reference and authentication guide.' },
      { name: 'Runbook', content: 'Incident response and deployment procedures.' },
    ],
    manualSteps: [],
  };
}
