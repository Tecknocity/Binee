export interface ChatMetric {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  source: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metrics?: ChatMetric[];
  suggestedFollowups?: string[];
  dataAsOf?: string;
  timestamp: string;
}

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg_1',
    role: 'user',
    content: 'How is my revenue doing this month?',
    timestamp: '2026-02-17T09:00:00Z',
  },
  {
    id: 'msg_2',
    role: 'assistant',
    content:
      'Your revenue is performing well this month. **MRR is at $32,450**, which represents a **12.5% increase** from last month\'s $28,844. You\'re on a solid growth trajectory.\n\nYour **total revenue for February is $85,000** so far, with **net profit at $23,000** after $62,000 in expenses. The profit margin of **27.1%** is healthy for a SaaS business at your stage.\n\nOne thing to watch: while revenue is growing, your **expenses increased by 5.98%** this period due to new hires and tool subscriptions. Your cash runway has shortened from 16 to **14 months** as a result.',
    metrics: [
      { name: 'MRR', value: '$32,450', trend: 'up', source: 'Stripe' },
      { name: 'MRR Growth', value: '12.5%', trend: 'up', source: 'Stripe' },
      {
        name: 'Net Profit',
        value: '$23,000',
        trend: 'up',
        source: 'QuickBooks',
      },
      {
        name: 'Cash Runway',
        value: '14 months',
        trend: 'down',
        source: 'QuickBooks',
      },
    ],
    suggestedFollowups: [
      'What is driving the expense increase?',
      'How does my MRR growth compare to previous months?',
      'What can I do to improve my profit margin?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:00:05Z',
  },
  {
    id: 'msg_3',
    role: 'user',
    content: 'What are the biggest risks to my business right now?',
    timestamp: '2026-02-17T09:02:00Z',
  },
  {
    id: 'msg_4',
    role: 'assistant',
    content:
      'I\'ve identified **3 key risk areas** you should focus on:\n\n### 1. Churn Rate Spike (Critical)\nYour **churn rate has risen to 3.2%**, up from 2.8% last month. The spike is concentrated among customers in their **first 90 days**, which suggests an onboarding gap. At this rate, you could lose approximately **$3,100 in MRR** over the next quarter.\n\n### 2. Pipeline Coverage Below Target (Warning)\nYour **pipeline coverage dropped to 2.8x**, below the recommended 3x minimum. Fewer new opportunities are entering the funnel, which puts your **Q2 revenue targets at risk** if not addressed soon.\n\n### 3. Deal Velocity Slowing (Info)\nAverage deal cycle has increased from 38 to **45 days**, primarily in the negotiation and legal review stages. The good news is your **average deal size increased to $16,700**, partly compensating for the slower pace.\n\nI\'d recommend prioritizing the churn issue first, as it has the most immediate revenue impact.',
    metrics: [
      { name: 'Churn Rate', value: '3.2%', trend: 'up', source: 'Stripe' },
      {
        name: 'Pipeline Coverage',
        value: '2.8x',
        trend: 'down',
        source: 'HubSpot',
      },
      {
        name: 'Deal Velocity',
        value: '45 days',
        trend: 'up',
        source: 'HubSpot',
      },
    ],
    suggestedFollowups: [
      'How can I reduce churn for new customers?',
      'What steps can I take to rebuild pipeline coverage?',
      'Show me details on which deals are slowing down.',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:02:08Z',
  },
  {
    id: 'msg_5',
    role: 'assistant',
    content:
      'Here\'s a quick summary of where your team stands operationally:\n\n**Team utilization is at 78%**, slightly below the 80% target. This dip is mainly due to two new hires ramping up \u2014 they\'re currently averaging **55% utilization** during onboarding.\n\nOn the delivery side, your team has completed **156 tasks** this sprint, which is actually up from 142 last period. However, there are **8 overdue tasks**, 3 of which are blockers for the February 28th release.\n\nYou currently have **12 active projects** running, up from 10 last month. I\'d recommend a quick triage session to address the overdue blockers before they delay the release.',
    metrics: [
      {
        name: 'Team Utilization',
        value: '78%',
        trend: 'down',
        source: 'ClickUp',
      },
      {
        name: 'Tasks Completed',
        value: '156',
        trend: 'up',
        source: 'ClickUp',
      },
      {
        name: 'Overdue Tasks',
        value: '8',
        trend: 'up',
        source: 'ClickUp',
      },
      {
        name: 'Active Projects',
        value: '12',
        trend: 'up',
        source: 'ClickUp',
      },
    ],
    suggestedFollowups: [
      'Which tasks are blocking the February release?',
      'How can I improve new-hire ramp-up time?',
      'Show me a breakdown of utilization by team member.',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:05:12Z',
  },
];

export const mockResponses: ChatMessage[] = [
  {
    id: 'resp_1',
    role: 'assistant',
    content:
      'Based on your current data, your **MRR of $32,450** is growing at a healthy **12.5% month-over-month**. At this growth rate, you\'re projected to hit your **$50K MRR goal by June 2026**, which is on track with your timeline.\n\nYour **ARR stands at $389,400**, putting you **78% of the way** toward the $500K ARR annual target. The key driver has been an increase in average deal size to **$16,700**, up from $15,200 last month.',
    metrics: [
      { name: 'MRR', value: '$32,450', trend: 'up', source: 'Stripe' },
      { name: 'ARR', value: '$389,400', trend: 'up', source: 'Stripe' },
      {
        name: 'Avg Deal Size',
        value: '$16,700',
        trend: 'up',
        source: 'HubSpot',
      },
    ],
    suggestedFollowups: [
      'What is driving the increase in deal size?',
      'How does my growth compare to SaaS benchmarks?',
      'What do I need to do to hit $50K MRR faster?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:10:00Z',
  },
  {
    id: 'resp_2',
    role: 'assistant',
    content:
      'Your customer acquisition metrics paint an interesting picture. Your **CAC has improved to $285**, down from $310 last month, which is a positive trend. Combined with an **LTV of $4,250**, your **LTV:CAC ratio is 14.9x**.\n\nWhile this sounds great on the surface, a ratio this high actually suggests you may be **under-investing in growth**. The SaaS benchmark for healthy growth is 3-5x. You have significant headroom to invest more aggressively in paid acquisition without breaking your unit economics.\n\nI\'d recommend testing an additional **$5,000/month in paid channels** to accelerate toward your 200-customer goal.',
    metrics: [
      { name: 'CAC', value: '$285', trend: 'down', source: 'HubSpot' },
      { name: 'LTV', value: '$4,250', trend: 'up', source: 'Stripe' },
      {
        name: 'Customers',
        value: '127',
        trend: 'up',
        source: 'HubSpot',
      },
    ],
    suggestedFollowups: [
      'Which paid channels would you recommend?',
      'How many customers can I expect from a $5K spend?',
      'What is my current customer breakdown by acquisition channel?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:15:00Z',
  },
  {
    id: 'resp_3',
    role: 'assistant',
    content:
      'Here\'s your financial health snapshot:\n\n| Metric | Value | Trend |\n|--------|-------|-------|\n| Total Revenue | **$85,000** | +8.7% |\n| Expenses | **$62,000** | +5.98% |\n| Net Profit | **$23,000** | +16.75% |\n| Cash Runway | **14 months** | -2 months |\n\nThe good news is your **profit margin is 27.1%** and growing, meaning revenue is outpacing expenses. However, the **cash runway decreased by 2 months** due to higher operational costs from new hires.\n\nI found **$2,000-$4,000 in potential savings** from consolidating overlapping tool subscriptions. Want me to walk through the details?',
    metrics: [
      {
        name: 'Total Revenue',
        value: '$85,000',
        trend: 'up',
        source: 'Stripe',
      },
      {
        name: 'Expenses',
        value: '$62,000',
        trend: 'up',
        source: 'QuickBooks',
      },
      {
        name: 'Net Profit',
        value: '$23,000',
        trend: 'up',
        source: 'QuickBooks',
      },
    ],
    suggestedFollowups: [
      'Show me the tool subscriptions I can consolidate.',
      'What are my biggest expense categories?',
      'How can I extend my cash runway?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:20:00Z',
  },
  {
    id: 'resp_4',
    role: 'assistant',
    content:
      'Let me break down your goal progress:\n\n1. **Reach $50K MRR** \u2014 65% complete, **on track**. Currently at $32,450 with a June 2026 deadline. You need to grow ~$4,400/month to hit this target.\n\n2. **Scale to 200 Customers** \u2014 64% complete, **on track**. At 127 customers, you need roughly 10 new customers per month through September.\n\n3. **Close $500K ARR** \u2014 78% complete, **on track**. At $389,400 with a December deadline, you have ample runway.\n\n4. **Reduce Churn Below 2%** \u2014 33% complete, **at risk**. Churn increased to 3.2% instead of decreasing. The retention campaign launching this month is critical.\n\n5. **Improve Team Utilization to 85%** \u2014 72% complete, **at risk**. At 78% with a March deadline, this goal needs immediate attention.',
    metrics: [
      { name: 'Goals On Track', value: '3 of 5', trend: 'flat', source: 'Binee' },
      { name: 'Goals At Risk', value: '2 of 5', trend: 'up', source: 'Binee' },
    ],
    suggestedFollowups: [
      'What can I do to get the at-risk goals back on track?',
      'Should I adjust the churn target deadline?',
      'How do I accelerate the MRR goal?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:25:00Z',
  },
  {
    id: 'resp_5',
    role: 'assistant',
    content:
      'Looking at your sales pipeline, here are the key insights:\n\nYou have **$91,660 in active pipeline** across 14 open opportunities. With your current win rate of **32%** and average deal size of **$16,700**, you\'re projected to close **$29,331 in new business** this quarter.\n\nHowever, your **pipeline coverage is at 2.8x**, which is below the 3x minimum for predictable growth. To restore healthy coverage, you need to add approximately **$47,000 in new pipeline** over the next 30 days.\n\nThe bright spot: your top 3 deals account for **$48,200** in potential revenue and are all in late-stage negotiation. Closing even 2 of these would significantly boost your quarterly numbers.',
    metrics: [
      {
        name: 'Active Pipeline',
        value: '$91,660',
        trend: 'down',
        source: 'HubSpot',
      },
      {
        name: 'Win Rate',
        value: '32%',
        trend: 'flat',
        source: 'HubSpot',
      },
      {
        name: 'Pipeline Coverage',
        value: '2.8x',
        trend: 'down',
        source: 'HubSpot',
      },
    ],
    suggestedFollowups: [
      'Which deals are closest to closing?',
      'How can I improve my win rate?',
      'What should I prioritize to rebuild pipeline?',
    ],
    dataAsOf: '2026-02-17T09:00:00Z',
    timestamp: '2026-02-17T09:30:00Z',
  },
];

export const starterQuestions: string[] = [
  'How is my business doing this month?',
  'What are the biggest risks I should focus on?',
  'Am I on track to hit my revenue goals?',
  'Show me a summary of my team\'s performance.',
];
