export type IntegrationCategory =
  | 'CRM & Sales'
  | 'Finance & Payments'
  | 'Project Management'
  | 'Communication';

export type IntegrationStatus = 'connected' | 'not_connected' | 'coming_soon';

export interface Integration {
  id: string;
  name: string;
  slug: string;
  category: IntegrationCategory;
  description: string;
  icon: string;
  isConnected: boolean;
  isComingSoon: boolean;
  lastSyncedAt: string | null;
  datapointsSynced: number | null;
  syncFrequency: string;
  connectedAccount: string | null;
}

export const mockIntegrations: Integration[] = [
  // CRM & Sales
  {
    id: 'int_1',
    name: 'HubSpot',
    slug: 'hubspot',
    category: 'CRM & Sales',
    description:
      'Sync contacts, deals, and pipeline data from your HubSpot CRM to track sales performance and customer relationships.',
    icon: 'Target',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T08:30:00Z',
    datapointsSynced: 12847,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: 'arman@tecknocity.com',
  },
  {
    id: 'int_2',
    name: 'Salesforce',
    slug: 'salesforce',
    category: 'CRM & Sales',
    description:
      'Connect your Salesforce instance to pull in accounts, opportunities, and forecasting data for comprehensive sales insights.',
    icon: 'Cloud',
    isConnected: false,
    isComingSoon: true,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },

  // Finance & Payments
  {
    id: 'int_3',
    name: 'Stripe',
    slug: 'stripe',
    category: 'Finance & Payments',
    description:
      'Import subscription revenue, payment history, and customer billing data from Stripe to monitor MRR and financial health.',
    icon: 'CreditCard',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T09:00:00Z',
    datapointsSynced: 8432,
    syncFrequency: 'Every 30 minutes',
    connectedAccount: 'acct_tecknocity_live',
  },
  {
    id: 'int_4',
    name: 'QuickBooks',
    slug: 'quickbooks',
    category: 'Finance & Payments',
    description:
      'Sync expenses, invoices, and profit-and-loss data from QuickBooks to track cash flow, runway, and overall financial performance.',
    icon: 'BookOpen',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T07:45:00Z',
    datapointsSynced: 5219,
    syncFrequency: 'Every hour',
    connectedAccount: 'Tecknocity Inc.',
  },

  // Project Management
  {
    id: 'int_5',
    name: 'ClickUp',
    slug: 'clickup',
    category: 'Project Management',
    description:
      'Pull in tasks, sprints, and project timelines from ClickUp to measure team velocity, utilization, and delivery progress.',
    icon: 'CheckSquare',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T08:15:00Z',
    datapointsSynced: 3764,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: 'Tecknocity Workspace',
  },
  {
    id: 'int_6',
    name: 'Asana',
    slug: 'asana',
    category: 'Project Management',
    description:
      'Connect Asana to import project boards, task assignments, and milestones for a unified view of operational progress.',
    icon: 'Layout',
    isConnected: false,
    isComingSoon: true,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },
  {
    id: 'int_7',
    name: 'Notion',
    slug: 'notion',
    category: 'Project Management',
    description:
      'Sync pages, databases, and knowledge base content from Notion to enrich your business context and planning data.',
    icon: 'FileText',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every hour',
    connectedAccount: null,
  },

  // Communication
  {
    id: 'int_8',
    name: 'Gmail',
    slug: 'gmail',
    category: 'Communication',
    description:
      'Analyze email volume, response times, and communication patterns to surface relationship insights and follow-up reminders.',
    icon: 'Mail',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 30 minutes',
    connectedAccount: null,
  },
  {
    id: 'int_9',
    name: 'Slack',
    slug: 'slack',
    category: 'Communication',
    description:
      'Connect Slack to receive real-time alerts, digest summaries, and enable conversational queries directly in your workspace.',
    icon: 'MessageSquare',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Real-time',
    connectedAccount: null,
  },
  {
    id: 'int_10',
    name: 'Google Calendar',
    slug: 'google-calendar',
    category: 'Communication',
    description:
      'Import calendar events and meeting schedules to analyze time allocation, meeting load, and availability patterns.',
    icon: 'Calendar',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },
];

export const integrationCategories: IntegrationCategory[] = [
  'CRM & Sales',
  'Finance & Payments',
  'Project Management',
  'Communication',
];
