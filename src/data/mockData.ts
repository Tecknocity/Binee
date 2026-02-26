import { MockData } from '../types/dashboard';

export const mockData: MockData = {
  metrics: {
    cash: 247500,
    mrr: 85000,
    customers: 127,
    projects: 12,
  },
  revenue: [
    { month: 'Aug', revenue: 72000, expenses: 54000, profit: 18000 },
    { month: 'Sep', revenue: 78000, expenses: 58000, profit: 20000 },
    { month: 'Oct', revenue: 82000, expenses: 60000, profit: 22000 },
    { month: 'Nov', revenue: 85000, expenses: 62000, profit: 23000 },
    { month: 'Dec', revenue: 92000, expenses: 63000, profit: 29000 },
  ],
  revenueMetrics: {
    totalRevenue: 85000,
    profitMargin: 27,
    profitAmount: 23000,
    pipelineValue: 385000,
    pipelineDeals: 23,
    avgDealSize: 16700,
    avgDealCycle: 45,
  },
  revenueBySource: [
    { source: 'Subscriptions', value: 68000, percentage: 80 },
    { source: 'Services', value: 12000, percentage: 14 },
    { source: 'One-time', value: 5000, percentage: 6 },
  ],
  expenseBreakdown: [
    { category: 'Payroll', value: 38000 },
    { category: 'Software', value: 9500 },
    { category: 'Marketing', value: 6800 },
    { category: 'Operations', value: 5200 },
    { category: 'Other', value: 3500 },
  ],
  predictions: [
    {
      title: 'Revenue Forecast - Q1',
      prediction: '$265K',
      confidence: 82,
      details: 'Based on pipeline and 34% win rate.',
    },
    {
      title: 'Churn Risk Alert',
      prediction: '18 customers at risk',
      confidence: 76,
      details: '18 customers showing churn signals.',
    },
  ],
  operationsMetrics: {
    activeProjects: 12,
    teamCapacity: 78,
    tasksCompleted: 156,
    overdueTasks: 8,
  },
  projects: [
    { name: 'Website Redesign', status: 'on-track', progress: 65, budget: 25000, spent: 18000, dueIn: 12 },
    { name: 'Product Launch', status: 'at-risk', progress: 40, budget: 50000, spent: 42000, dueIn: 8 },
    { name: 'Marketing Campaign', status: 'on-track', progress: 85, budget: 15000, spent: 12000, dueIn: 25 },
    { name: 'API Integration', status: 'delayed', progress: 30, budget: 20000, spent: 15000, dueIn: -3 },
  ],
  teamPerformance: [
    { member: 'Sarah J.', tasksCompleted: 42, hoursLogged: 95 },
    { member: 'Mike T.', tasksCompleted: 35, hoursLogged: 78 },
    { member: 'Emma K.', tasksCompleted: 38, hoursLogged: 86 },
    { member: 'David R.', tasksCompleted: 28, hoursLogged: 65 },
  ],
  taskCompletionTrend: [
    { week: 'Week 1', completed: 35, created: 42 },
    { week: 'Week 2', completed: 38, created: 40 },
    { week: 'Week 3', completed: 45, created: 44 },
    { week: 'Week 4', completed: 42, created: 38 },
  ],
  teamCapacityUtilization: [
    { member: 'Sarah J.', utilization: 92 },
    { member: 'Mike T.', utilization: 78 },
    { member: 'Emma K.', utilization: 85 },
    { member: 'David R.', utilization: 65 },
  ],
  goals: [
    { name: 'Hit $100K MRR', current: 85000, target: 100000, unit: 'USD', status: 'on-track' },
    { name: 'Reach 200 Customers', current: 127, target: 200, unit: 'customers', status: 'at-risk' },
  ],
  integrationHealth: {
    lastChecked: '2026-02-17T09:15:00Z',
    issues: [
      { id: 'ih_1', integrationSlug: 'hubspot', integrationName: 'HubSpot', type: 'rate_limit', severity: 'critical', title: 'API rate limit exceeded', description: 'HubSpot free account is limited to 100 API calls per 10 seconds. Current usage exceeds this limit, causing sync failures. Consider upgrading to a paid HubSpot plan or reducing sync frequency.', occurredAt: '2026-02-17T08:42:00Z', status: 'active', errorCode: '429', resolution: 'Upgrade HubSpot plan or reduce sync frequency to "Every hour"' },
      { id: 'ih_2', integrationSlug: 'quickbooks', integrationName: 'QuickBooks', type: 'auth_error', severity: 'critical', title: 'Authentication token expired', description: 'The OAuth refresh token for QuickBooks has expired. Data sync has been paused. Please reconnect QuickBooks to restore data flow.', occurredAt: '2026-02-17T07:30:00Z', status: 'active', errorCode: 'OAUTH_TOKEN_EXPIRED', resolution: 'Reconnect QuickBooks from the Integrations page' },
      { id: 'ih_3', integrationSlug: 'clickup', integrationName: 'ClickUp', type: 'permission_error', severity: 'warning', title: 'Missing permissions for time tracking', description: 'The connected ClickUp account does not have permission to access time tracking data. Time-related metrics will be unavailable until permissions are granted.', occurredAt: '2026-02-16T14:20:00Z', status: 'active', errorCode: 'OAUTH_SCOPE_INSUFFICIENT', resolution: 'Re-authorize ClickUp with time tracking permissions enabled' },
      { id: 'ih_4', integrationSlug: 'stripe', integrationName: 'Stripe', type: 'sync_failure', severity: 'warning', title: 'Partial sync failure on subscription data', description: '12 subscription records failed to sync due to a temporary Stripe API outage. The system will retry automatically on the next sync cycle.', occurredAt: '2026-02-17T06:00:00Z', status: 'acknowledged', errorCode: '503', resolution: 'Will retry automatically. If issue persists, check Stripe status page.' },
      { id: 'ih_5', integrationSlug: 'hubspot', integrationName: 'HubSpot', type: 'config_warning', severity: 'info', title: 'Custom properties not mapped', description: '5 custom deal properties in HubSpot are not mapped to Binee fields. These properties will be ignored during sync until configured.', occurredAt: '2026-02-15T10:00:00Z', status: 'active', resolution: 'Configure custom property mappings in integration settings' },
      { id: 'ih_6', integrationSlug: 'clickup', integrationName: 'ClickUp', type: 'api_error', severity: 'info', title: 'Webhook delivery failures detected', description: '3 webhook events from ClickUp failed to deliver in the last 24 hours. Real-time task updates may be delayed. Falling back to polling-based sync.', occurredAt: '2026-02-16T22:15:00Z', status: 'resolved', errorCode: 'WEBHOOK_DELIVERY_FAILED', resolution: 'Webhook endpoint has been reset. Monitoring for recurrence.' },
    ],
  },
  suggestions: [
    { priority: 'high', title: 'Restructure Pipeline Stages', reasoning: "Your 10 stages don't map to standard B2B framework. This blocks benchmarking.", impact: 'Unlock industry benchmarks + forecasting', effort: '30 min', action: 'Apply' },
    { priority: 'high', title: 'Add "Lost Reason" Field', reasoning: "You can't analyze why deals are lost without tracking reasons.", impact: 'Enable churn analysis', effort: '10 min', action: 'Setup' },
    { priority: 'medium', title: 'Clean Up Duplicate Contacts', reasoning: '23 contacts appear multiple times with slight variations.', impact: 'Improve data quality score (+12 pts)', effort: '45 min', action: 'Review' },
    { priority: 'medium', title: 'Standardize Project Tags', reasoning: 'Inconsistent tagging makes filtering unreliable.', impact: 'Better project tracking', effort: '20 min', action: 'Fix' },
    { priority: 'low', title: 'Enable Two-Factor Auth', reasoning: 'Add extra security layer for team accounts.', impact: 'Enhanced security', effort: '15 min', action: 'Enable' },
  ],
  pipeline: [
    { stage: 'Lead', count: 8, value: 95000 },
    { stage: 'Qualified', count: 12, value: 185000 },
    { stage: 'Proposal', count: 6, value: 145000 },
    { stage: 'Negotiation', count: 4, value: 120000 },
  ],
  highValueDeals: [
    { company: 'Acme Corp', value: 45000, stage: 'Negotiation', probability: 75, daysInStage: 8, status: 'Active' },
    { company: 'TechStart Inc', value: 38000, stage: 'Proposal', probability: 60, daysInStage: 21, status: 'Stuck' },
    { company: 'Beta Systems', value: 32000, stage: 'Proposal', probability: 40, daysInStage: 28, status: 'Stuck' },
  ],
};
