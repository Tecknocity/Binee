export interface Notification {
  id: string;
  type: 'issue' | 'goal' | 'sync-error' | 'suggestion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl: string;
}

export const mockNotifications: Notification[] = [
  {
    id: 'notif_1',
    type: 'issue',
    title: 'Critical: Churn Rate Spike Detected',
    message:
      'Your churn rate has increased to 3.2%, exceeding the 3% threshold. Early-stage customers are most at risk.',
    read: false,
    createdAt: '2026-02-15T14:30:00Z',
    actionUrl: '/issues/issue_1',
  },
  {
    id: 'notif_2',
    type: 'goal',
    title: 'Goal Milestone Reached: $30K MRR',
    message:
      'Congratulations! You hit the $30K MRR milestone for your "Reach $50K MRR" goal. You\'re 65% of the way there.',
    read: true,
    createdAt: '2026-02-01T08:00:00Z',
    actionUrl: '/goals/goal_1',
  },
  {
    id: 'notif_3',
    type: 'suggestion',
    title: 'New Suggestion: Launch Onboarding Email Sequence',
    message:
      'Based on the churn spike, we recommend launching a 90-day onboarding drip campaign to improve early retention.',
    read: false,
    createdAt: '2026-02-15T15:00:00Z',
    actionUrl: '/suggestions/sug_1',
  },
  {
    id: 'notif_4',
    type: 'issue',
    title: 'Warning: Pipeline Coverage Below 3x',
    message:
      'Pipeline coverage has dropped to 2.8x, below the recommended minimum. New opportunity generation has slowed.',
    read: false,
    createdAt: '2026-02-14T10:00:00Z',
    actionUrl: '/issues/issue_2',
  },
  {
    id: 'notif_5',
    type: 'sync-error',
    title: 'QuickBooks Sync Delayed',
    message:
      'The scheduled QuickBooks sync at 6:00 AM was delayed by 1 hour 45 minutes due to a temporary API timeout. Data is now up to date.',
    read: true,
    createdAt: '2026-02-13T07:45:00Z',
    actionUrl: '/integrations/quickbooks',
  },
  {
    id: 'notif_6',
    type: 'system',
    title: 'February Business Report Ready',
    message:
      'Your weekly business intelligence report for Feb 10-16 is ready to view. Revenue grew 12.5% with 9 new customers.',
    read: true,
    createdAt: '2026-02-16T07:00:00Z',
    actionUrl: '/reports/weekly',
  },
  {
    id: 'notif_7',
    type: 'goal',
    title: 'Goal At Risk: Reduce Churn Below 2%',
    message:
      'Your churn reduction goal is now flagged as at-risk. Churn increased to 3.2% instead of trending toward the 2% target.',
    read: false,
    createdAt: '2026-02-15T16:00:00Z',
    actionUrl: '/goals/goal_2',
  },
  {
    id: 'notif_8',
    type: 'suggestion',
    title: 'Quick Win: Audit Tool Subscriptions',
    message:
      'We identified $2,000-$4,000 in potential monthly savings by consolidating overlapping SaaS subscriptions.',
    read: false,
    createdAt: '2026-02-13T10:30:00Z',
    actionUrl: '/suggestions/sug_4',
  },
];
