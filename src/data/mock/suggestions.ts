export interface Suggestion {
  id: string;
  title: string;
  category: 'quick-win' | 'this-week' | 'strategic';
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  relatedIssueIds: string[];
  steps: string[];
  isFromKnowledgeBase: boolean;
}

export const mockSuggestions: Suggestion[] = [
  {
    id: 'sug_1',
    title: 'Launch a 90-Day Onboarding Email Sequence',
    category: 'this-week',
    description:
      'Create an automated drip campaign targeting new customers in their first 90 days. Focus on product education, feature discovery, and success stories to combat the early-stage churn spike detected this month.',
    expectedImpact:
      'Reduce early-stage churn by 30-40%, potentially saving $930-$1,240 in MRR per month.',
    effort: 'medium',
    relatedIssueIds: ['issue_1'],
    steps: [
      'Map the ideal customer journey for the first 90 days',
      'Write 8-10 email templates covering onboarding milestones',
      'Set up automated triggers in HubSpot based on signup date',
      'Create a dashboard to track open rates and engagement',
      'Review and iterate after the first 30 days of data',
    ],
    isFromKnowledgeBase: true,
  },
  {
    id: 'sug_2',
    title: 'Schedule Personalized Check-In Calls for At-Risk Accounts',
    category: 'quick-win',
    description:
      'Proactively reach out to the 12 accounts showing declining engagement signals. A 15-minute check-in call can uncover issues before they lead to cancellation and shows customers you care about their success.',
    expectedImpact:
      'Retain 3-5 at-risk accounts worth an estimated $4,800-$8,000 in annual revenue.',
    effort: 'low',
    relatedIssueIds: ['issue_1'],
    steps: [
      'Pull the list of 12 at-risk accounts from HubSpot engagement scores',
      'Draft a brief call script focused on understanding their needs',
      'Schedule calls over the next 5 business days',
      'Log feedback and action items in HubSpot after each call',
    ],
    isFromKnowledgeBase: false,
  },
  {
    id: 'sug_3',
    title: 'Increase Outbound Prospecting by 25%',
    category: 'this-week',
    description:
      'Pipeline coverage has dropped below the 3x safety threshold. Increasing outbound activity will help rebuild the pipeline and ensure Q2 revenue targets remain achievable.',
    expectedImpact:
      'Generate 8-12 additional qualified opportunities per month, restoring pipeline coverage to 3.2x or higher.',
    effort: 'medium',
    relatedIssueIds: ['issue_2'],
    steps: [
      'Review and update ideal customer profile targeting criteria',
      'Create 3 new outbound email sequences in HubSpot',
      'Allocate 2 additional hours per day per SDR for prospecting',
      'Set up weekly pipeline review meetings to track progress',
      'Re-engage 20 stalled opportunities with a fresh value proposition',
    ],
    isFromKnowledgeBase: true,
  },
  {
    id: 'sug_4',
    title: 'Audit and Consolidate Tool Subscriptions',
    category: 'quick-win',
    description:
      'Review all active SaaS subscriptions to identify overlapping tools, unused licenses, and opportunities to negotiate annual discounts. This can quickly reduce monthly expenses without impacting productivity.',
    expectedImpact:
      'Reduce monthly expenses by $2,000-$4,000, extending cash runway by 1-2 months.',
    effort: 'low',
    relatedIssueIds: ['issue_3'],
    steps: [
      'Export a complete list of all active subscriptions from QuickBooks',
      'Identify tools with overlapping functionality',
      'Cancel unused or underutilized licenses',
      'Negotiate annual pricing for top 5 essential tools',
    ],
    isFromKnowledgeBase: false,
  },
  {
    id: 'sug_5',
    title: 'Triage and Reassign Overdue Sprint Tasks',
    category: 'quick-win',
    description:
      'Hold a focused 30-minute triage session to address the 8 overdue tasks blocking the February 28th release. Redistribute work based on current team capacity to get the sprint back on track.',
    expectedImpact:
      'Unblock the product release and improve sprint completion rate from 85% to 95%.',
    effort: 'low',
    relatedIssueIds: ['issue_4'],
    steps: [
      'Schedule a 30-minute triage meeting with engineering and design leads',
      'Categorize overdue tasks as critical-path or deferrable',
      'Reassign critical tasks to team members with available capacity',
      'Move non-critical items to the next sprint backlog',
    ],
    isFromKnowledgeBase: false,
  },
  {
    id: 'sug_6',
    title: 'Create Standardized Proposal Templates',
    category: 'this-week',
    description:
      'Deal velocity has slowed primarily in the negotiation and legal review stages. Building a library of pre-approved proposal and contract templates will reduce back-and-forth and accelerate time to close.',
    expectedImpact:
      'Reduce average deal cycle time by 7-10 days, from 45 days to approximately 35 days.',
    effort: 'medium',
    relatedIssueIds: ['issue_5'],
    steps: [
      'Analyze the last 20 closed deals to identify common terms and structures',
      'Create 3 proposal templates (small, medium, enterprise)',
      'Get legal pre-approval on standard contract terms',
      'Build the templates in HubSpot for one-click generation',
      'Train the sales team on using the new templates',
    ],
    isFromKnowledgeBase: true,
  },
  {
    id: 'sug_7',
    title: 'Launch a Structured New-Hire Buddy Program',
    category: 'strategic',
    description:
      'New team members are averaging 55% utilization during ramp-up, dragging the overall team utilization below target. A structured buddy program will accelerate onboarding and get new hires productive faster.',
    expectedImpact:
      'Reduce new-hire ramp-up time from 8 weeks to 5 weeks, improving team utilization to 82-85%.',
    effort: 'medium',
    relatedIssueIds: ['issue_6'],
    steps: [
      'Define the buddy program structure and expectations',
      'Pair each new hire with a senior team member on an active project',
      'Create a 30-60-90 day onboarding checklist in ClickUp',
      'Schedule weekly 1:1s between buddies and new hires',
      'Track utilization weekly and adjust assignments as needed',
    ],
    isFromKnowledgeBase: true,
  },
  {
    id: 'sug_8',
    title: 'Invest $5K/Month in Paid Acquisition Channels',
    category: 'strategic',
    description:
      'The LTV:CAC ratio of 14.9x indicates significant headroom to invest more aggressively in customer acquisition. Testing paid channels can accelerate growth toward the 200-customer target while maintaining healthy unit economics.',
    expectedImpact:
      'Acquire 15-20 additional customers per month at an estimated CAC of $350, bringing the LTV:CAC ratio to a healthier 8-10x growth range.',
    effort: 'high',
    relatedIssueIds: ['issue_7'],
    steps: [
      'Define target audience segments for Google Ads and LinkedIn',
      'Set up conversion tracking and attribution in HubSpot',
      'Launch test campaigns with $2,500 budget split across channels',
      'Monitor CPA and quality metrics daily for the first 2 weeks',
      'Scale the winning channel to the full $5,000 monthly budget',
      'Review and report on ROI after 30 days',
    ],
    isFromKnowledgeBase: false,
  },
  {
    id: 'sug_9',
    title: 'Implement a Customer Health Score Dashboard',
    category: 'strategic',
    description:
      'Build an automated health scoring system that combines product usage, payment history, and support interactions to predict churn risk before it happens. This provides a proactive view of customer health across the entire base.',
    expectedImpact:
      'Identify at-risk accounts 30 days earlier, reducing overall churn rate by an estimated 0.5-1.0 percentage points.',
    effort: 'high',
    relatedIssueIds: ['issue_1', 'issue_5'],
    steps: [
      'Define health score criteria: usage frequency, support tickets, payment status, NPS',
      'Set up data aggregation from Stripe and HubSpot',
      'Build a weighted scoring model with red/yellow/green thresholds',
      'Create a real-time dashboard in Binee to surface at-risk accounts',
      'Set up automated alerts when accounts drop into the red zone',
      'Establish a weekly customer health review process',
    ],
    isFromKnowledgeBase: true,
  },
  {
    id: 'sug_10',
    title: 'Run a Win-Back Campaign for Churned Customers',
    category: 'this-week',
    description:
      'Re-engage the 18 customers who churned in the past 90 days with a targeted win-back offer. Former customers are easier to convert than new prospects and already understand your product value.',
    expectedImpact:
      'Win back 3-5 customers worth approximately $2,500-$4,200 in MRR at minimal acquisition cost.',
    effort: 'low',
    relatedIssueIds: ['issue_1', 'issue_2'],
    steps: [
      'Pull the list of 18 churned customers from Stripe',
      'Segment by churn reason (price, feature gap, competitor, other)',
      'Craft personalized win-back emails with a limited-time offer',
      'Send campaigns via HubSpot with a 7-day follow-up sequence',
      'Track re-activation rate and revenue recovered',
    ],
    isFromKnowledgeBase: false,
  },
];
