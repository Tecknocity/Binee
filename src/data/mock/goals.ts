export interface GoalMilestone {
  id: string;
  name: string;
  targetDate: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  name: string;
  category: 'revenue' | 'operations' | 'growth' | 'custom';
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  progress: number;
  status: 'on-track' | 'at-risk' | 'behind';
  deadline: string;
  milestones: GoalMilestone[];
  sources: string[];
  createdAt: string;
}

export const mockGoals: Goal[] = [
  {
    id: 'goal_1',
    name: 'Reach $50K MRR',
    category: 'revenue',
    targetMetric: 'mrr',
    targetValue: 50000,
    currentValue: 32450,
    progress: 65,
    status: 'on-track',
    deadline: '2026-06-30',
    milestones: [
      {
        id: 'ms_1a',
        name: 'Hit $25K MRR',
        targetDate: '2025-12-31',
        completed: true,
      },
      {
        id: 'ms_1b',
        name: 'Hit $30K MRR',
        targetDate: '2026-01-31',
        completed: true,
      },
      {
        id: 'ms_1c',
        name: 'Hit $40K MRR',
        targetDate: '2026-04-30',
        completed: false,
      },
      {
        id: 'ms_1d',
        name: 'Hit $50K MRR',
        targetDate: '2026-06-30',
        completed: false,
      },
    ],
    sources: ['Stripe'],
    createdAt: '2025-10-01T09:00:00Z',
  },
  {
    id: 'goal_2',
    name: 'Reduce Churn Below 2%',
    category: 'growth',
    targetMetric: 'churnRate',
    targetValue: 2.0,
    currentValue: 3.2,
    progress: 33,
    status: 'at-risk',
    deadline: '2026-06-30',
    milestones: [
      {
        id: 'ms_2a',
        name: 'Identify top churn reasons',
        targetDate: '2026-01-15',
        completed: true,
      },
      {
        id: 'ms_2b',
        name: 'Launch retention campaign',
        targetDate: '2026-02-28',
        completed: false,
      },
      {
        id: 'ms_2c',
        name: 'Churn below 2.5%',
        targetDate: '2026-04-30',
        completed: false,
      },
      {
        id: 'ms_2d',
        name: 'Churn below 2%',
        targetDate: '2026-06-30',
        completed: false,
      },
    ],
    sources: ['Stripe', 'HubSpot'],
    createdAt: '2025-11-15T14:00:00Z',
  },
  {
    id: 'goal_3',
    name: 'Scale to 200 Customers',
    category: 'growth',
    targetMetric: 'customerCount',
    targetValue: 200,
    currentValue: 127,
    progress: 64,
    status: 'on-track',
    deadline: '2026-09-30',
    milestones: [
      {
        id: 'ms_3a',
        name: 'Reach 100 customers',
        targetDate: '2025-12-31',
        completed: true,
      },
      {
        id: 'ms_3b',
        name: 'Reach 150 customers',
        targetDate: '2026-04-30',
        completed: false,
      },
      {
        id: 'ms_3c',
        name: 'Reach 200 customers',
        targetDate: '2026-09-30',
        completed: false,
      },
    ],
    sources: ['HubSpot', 'Stripe'],
    createdAt: '2025-10-01T09:00:00Z',
  },
  {
    id: 'goal_4',
    name: 'Improve Team Utilization to 85%',
    category: 'operations',
    targetMetric: 'teamUtilization',
    targetValue: 85,
    currentValue: 78,
    progress: 72,
    status: 'at-risk',
    deadline: '2026-03-31',
    milestones: [
      {
        id: 'ms_4a',
        name: 'Audit current task allocation',
        targetDate: '2026-01-15',
        completed: true,
      },
      {
        id: 'ms_4b',
        name: 'Implement new sprint planning',
        targetDate: '2026-02-15',
        completed: true,
      },
      {
        id: 'ms_4c',
        name: 'Reach 85% utilization',
        targetDate: '2026-03-31',
        completed: false,
      },
    ],
    sources: ['ClickUp'],
    createdAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 'goal_5',
    name: 'Close $500K in New ARR',
    category: 'revenue',
    targetMetric: 'arr',
    targetValue: 500000,
    currentValue: 389400,
    progress: 78,
    status: 'on-track',
    deadline: '2026-12-31',
    milestones: [
      {
        id: 'ms_5a',
        name: 'Close $300K ARR',
        targetDate: '2025-12-31',
        completed: true,
      },
      {
        id: 'ms_5b',
        name: 'Close $400K ARR',
        targetDate: '2026-03-31',
        completed: false,
      },
      {
        id: 'ms_5c',
        name: 'Close $450K ARR',
        targetDate: '2026-08-31',
        completed: false,
      },
      {
        id: 'ms_5d',
        name: 'Close $500K ARR',
        targetDate: '2026-12-31',
        completed: false,
      },
    ],
    sources: ['HubSpot', 'Stripe'],
    createdAt: '2025-09-15T10:00:00Z',
  },
];
