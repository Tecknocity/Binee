import type { SetupPlan } from './session';
import { generateManualSteps } from './manual-steps';

export function parseAIResponseToPlan(aiResponse: string): SetupPlan {
  try {
    const parsed = JSON.parse(aiResponse);
    const plan: SetupPlan = {
      spaces: parsed.spaces || [],
      docs: parsed.docs || [],
      manualSteps: [],
    };
    plan.manualSteps = generateManualSteps(plan);
    return plan;
  } catch {
    // If not JSON, return a default plan
    return generateDefaultPlan('agency');
  }
}

export function generateDefaultPlan(businessType: string): SetupPlan {
  const templates: Record<string, () => SetupPlan> = {
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

function buildAgencyPlan(): SetupPlan {
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

function buildStartupPlan(): SetupPlan {
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

function buildEcommercePlan(): SetupPlan {
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

function buildConsultingPlan(): SetupPlan {
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

function buildSaaSPlan(): SetupPlan {
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
