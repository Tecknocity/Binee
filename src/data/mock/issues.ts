export interface ImpactedMetric {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
}

export interface Issue {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  area: 'revenue' | 'operations' | 'growth';
  description: string;
  impactedMetrics: ImpactedMetric[];
  suggestedFix: string;
  sources: string[];
  detectedAt: string;
  status: 'new' | 'acknowledged' | 'in-progress' | 'resolved';
}

export const mockIssues: Issue[] = [
  {
    id: 'issue_1',
    title: 'Churn Rate Spiking Above Target',
    severity: 'critical',
    area: 'revenue',
    description:
      'Monthly churn rate has increased from 2.8% to 3.2% over the past 30 days, exceeding the 3% threshold. Analysis shows the spike is concentrated among customers in the first 90 days of their subscription. If this trend continues, it could reduce MRR by approximately $3,100 over the next quarter.',
    impactedMetrics: [
      { name: 'Churn Rate', value: '3.2%', trend: 'up' },
      { name: 'MRR at Risk', value: '$3,100', trend: 'up' },
      { name: 'Customer Count', value: '127', trend: 'down' },
    ],
    suggestedFix:
      'Implement an automated onboarding email sequence targeting users in their first 90 days. Schedule personalized check-in calls for accounts showing low engagement in week 2.',
    sources: ['Stripe', 'HubSpot'],
    detectedAt: '2026-02-15T14:30:00Z',
    status: 'new',
  },
  {
    id: 'issue_2',
    title: 'Pipeline Coverage Below 3x Target',
    severity: 'warning',
    area: 'revenue',
    description:
      'Pipeline coverage has dropped to 2.8x from 3.1x last month, falling below the recommended 3x minimum for predictable revenue growth. The decline is primarily due to fewer new opportunities entering the pipeline in the last two weeks. Current close rate trends suggest Q2 targets may be at risk without intervention.',
    impactedMetrics: [
      { name: 'Pipeline Coverage', value: '2.8x', trend: 'down' },
      { name: 'New Opportunities', value: '14', trend: 'down' },
      { name: 'Average Deal Size', value: '$16,700', trend: 'up' },
    ],
    suggestedFix:
      'Increase outbound prospecting activity by 25% this month. Consider launching a targeted campaign to re-engage stalled opportunities in the pipeline and review lead qualification criteria.',
    sources: ['HubSpot'],
    detectedAt: '2026-02-14T10:00:00Z',
    status: 'acknowledged',
  },
  {
    id: 'issue_3',
    title: 'Cash Runway Decreased to 14 Months',
    severity: 'warning',
    area: 'revenue',
    description:
      'Cash runway has decreased from 16 months to 14 months due to increased operational expenses. The $3,500 expense increase was driven by new hiring and tool subscriptions. While still within a healthy range, this trajectory warrants monitoring as expenses grew faster than revenue this period.',
    impactedMetrics: [
      { name: 'Cash Runway', value: '14 months', trend: 'down' },
      { name: 'Monthly Expenses', value: '$62,000', trend: 'up' },
      { name: 'Net Profit', value: '$23,000', trend: 'up' },
    ],
    suggestedFix:
      'Review non-essential tool subscriptions and evaluate ROI. Consider negotiating annual contracts for key vendors to reduce monthly costs by an estimated 10-15%.',
    sources: ['QuickBooks'],
    detectedAt: '2026-02-13T09:15:00Z',
    status: 'in-progress',
  },
  {
    id: 'issue_4',
    title: '8 Overdue Tasks Blocking Sprint Progress',
    severity: 'warning',
    area: 'operations',
    description:
      'There are currently 8 overdue tasks in the active sprint, up from 5 last period. Three of these tasks are blockers for the upcoming product release scheduled for February 28th. The overdue items are spread across the engineering and design teams, suggesting a capacity issue rather than a single bottleneck.',
    impactedMetrics: [
      { name: 'Overdue Tasks', value: '8', trend: 'up' },
      { name: 'Team Utilization', value: '78%', trend: 'down' },
      { name: 'Sprint Velocity', value: '156 pts', trend: 'up' },
    ],
    suggestedFix:
      'Hold a focused triage session to re-prioritize the 8 overdue tasks. Reassign blocking tasks to team members with available capacity and consider descoping non-critical items from the current sprint.',
    sources: ['ClickUp'],
    detectedAt: '2026-02-16T11:00:00Z',
    status: 'new',
  },
  {
    id: 'issue_5',
    title: 'Deal Velocity Slowing Down',
    severity: 'info',
    area: 'growth',
    description:
      'Average deal cycle time has increased from 38 days to 45 days over the past two months. The slowdown appears concentrated in the negotiation and legal review stages, where deals are spending an average of 12 additional days. This is partly offset by a higher average deal size of $16,700.',
    impactedMetrics: [
      { name: 'Deal Velocity', value: '45 days', trend: 'up' },
      { name: 'Avg Deal Size', value: '$16,700', trend: 'up' },
      { name: 'Win Rate', value: '32%', trend: 'flat' },
    ],
    suggestedFix:
      'Streamline the proposal-to-contract process by creating standardized templates. Consider offering simplified pricing tiers to reduce negotiation time for deals under $10K.',
    sources: ['HubSpot'],
    detectedAt: '2026-02-12T16:45:00Z',
    status: 'acknowledged',
  },
  {
    id: 'issue_6',
    title: 'Team Utilization Below 80% Target',
    severity: 'info',
    area: 'operations',
    description:
      'Team utilization has dropped to 78% from 82% last month, falling below the 80% operational target. The decrease correlates with the onboarding of two new team members and an increase in internal meeting hours. New hires are currently averaging 55% utilization during their ramp-up period.',
    impactedMetrics: [
      { name: 'Team Utilization', value: '78%', trend: 'down' },
      { name: 'Active Projects', value: '12', trend: 'up' },
      { name: 'Completed Tasks', value: '156', trend: 'up' },
    ],
    suggestedFix:
      'Pair new hires with senior team members on active projects to accelerate ramp-up. Review recurring meeting schedules and consolidate where possible to free up productive hours.',
    sources: ['ClickUp'],
    detectedAt: '2026-02-10T08:30:00Z',
    status: 'in-progress',
  },
  {
    id: 'issue_7',
    title: 'CAC Trending Higher Than LTV:CAC Target',
    severity: 'warning',
    area: 'growth',
    description:
      'While CAC has improved from $310 to $285, the LTV:CAC ratio of 14.9x suggests over-investment in acquisition efficiency at the expense of growth velocity. Compared to the industry benchmark of 3-5x, the current ratio indicates room to invest more aggressively in paid acquisition channels to accelerate customer growth.',
    impactedMetrics: [
      { name: 'CAC', value: '$285', trend: 'down' },
      { name: 'LTV', value: '$4,250', trend: 'up' },
      { name: 'LTV:CAC Ratio', value: '14.9x', trend: 'up' },
    ],
    suggestedFix:
      'Allocate an additional $5,000/month to paid acquisition channels (Google Ads, LinkedIn) to test higher-volume growth. Target a LTV:CAC ratio closer to 5-8x for optimal growth efficiency.',
    sources: ['HubSpot', 'Stripe'],
    detectedAt: '2026-02-11T13:00:00Z',
    status: 'new',
  },
];
