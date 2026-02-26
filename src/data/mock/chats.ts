import { Conversation } from '@/types/chat';

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Business Health Review',
    createdAt: '2026-02-26T10:30:00Z',
    updatedAt: '2026-02-26T10:35:00Z',
    messages: [
      {
        id: 'msg-1-1',
        role: 'user',
        content: "What's my business health score?",
        timestamp: '2026-02-26T10:30:00Z',
      },
      {
        id: 'msg-1-2',
        role: 'ai',
        content: `Your overall business health score is **82/100** — that's in the **healthy** range! Here's the breakdown:\n- Revenue Growth: **\u219112.5%** MoM — Strong\n- Pipeline Coverage: **2.8x** — Adequate (aim for 3x+)\n- Team Utilization: **78%** — Good\n- Cash Runway: **14 months** — Comfortable\n\nThe main area needing attention is pipeline coverage — you're slightly below the 3x benchmark.`,
        timestamp: '2026-02-26T10:30:15Z',
        suggestedFollowups: [
          'How can I improve pipeline coverage?',
          'Show me revenue trends',
          "What's my churn rate?",
        ],
      },
    ],
  },
  {
    id: 'conv-2',
    title: 'Pipeline Risk Analysis',
    createdAt: '2026-02-25T14:00:00Z',
    updatedAt: '2026-02-25T14:05:00Z',
    messages: [
      {
        id: 'msg-2-1',
        role: 'user',
        content: 'Which deals are at risk?',
        timestamp: '2026-02-25T14:00:00Z',
      },
      {
        id: 'msg-2-2',
        role: 'ai',
        content: `I found **3 deals at risk** in your pipeline worth a total of **$115,000**:\n1. **TechStart Inc** — $38,000 — Stuck in Proposal for 21 days\n2. **Beta Systems** — $32,000 — Stuck in Proposal for 28 days\n3. **Global Services** — $45,000 — No activity for 15 days\n\nRecommended action: Schedule follow-ups for TechStart and Beta Systems this week. The average deal cycle is 45 days, and these are exceeding that.`,
        timestamp: '2026-02-25T14:00:12Z',
        suggestedFollowups: [
          'Show me all pipeline deals',
          "What's the average close rate?",
          'Draft follow-up emails',
        ],
      },
    ],
  },
  {
    id: 'conv-3',
    title: 'Cash Flow Projection',
    createdAt: '2026-02-24T09:15:00Z',
    updatedAt: '2026-02-24T09:20:00Z',
    messages: [
      {
        id: 'msg-3-1',
        role: 'user',
        content: "How's my cash runway?",
        timestamp: '2026-02-24T09:15:00Z',
      },
      {
        id: 'msg-3-2',
        role: 'ai',
        content: `Your current cash runway is **14 months** based on:\n- Cash on hand: **$247,500**\n- Monthly burn rate: **$17,500** (avg of last 3 months)\n- MRR: **$32,450** \u219112.5%\n\nAt your current growth rate, you'll become cash-flow positive in approximately **4 months**. Your runway is extending by ~0.5 months each month due to revenue growth outpacing expenses.`,
        timestamp: '2026-02-24T09:15:10Z',
        suggestedFollowups: [
          'Show expense breakdown',
          "What's my path to profitability?",
          'How does this compare to benchmarks?',
        ],
      },
    ],
  },
  {
    id: 'conv-4',
    title: 'Weekly Focus Areas',
    createdAt: '2026-02-22T11:00:00Z',
    updatedAt: '2026-02-22T11:10:00Z',
    messages: [
      {
        id: 'msg-4-1',
        role: 'user',
        content: 'What should I focus on this week?',
        timestamp: '2026-02-22T11:00:00Z',
      },
      {
        id: 'msg-4-2',
        role: 'ai',
        content: `Based on your current data, here's what I'd focus on this week:\n\n1. **Follow up on 3 stuck deals** ($115K at risk) — These have been idle for 15-28 days\n2. **Review 8 overdue tasks** — Your team has tasks overdue by 7+ days in ClickUp\n3. **Clean up 15 deals missing amounts** — This is hurting your revenue forecast accuracy\n4. **Check Product Launch project** — Budget is 84% spent but only 40% complete\n\nQuick win: Add missing deal amounts in HubSpot (~30 min) to improve forecast accuracy by ~20%.`,
        timestamp: '2026-02-22T11:00:18Z',
        suggestedFollowups: [
          'Tell me more about the Product Launch',
          'How do I improve forecast accuracy?',
          'Show team performance',
        ],
      },
    ],
  },
  {
    id: 'conv-5',
    title: 'Q1 Revenue Strategy',
    createdAt: '2026-02-20T16:30:00Z',
    updatedAt: '2026-02-20T16:45:00Z',
    messages: [
      {
        id: 'msg-5-1',
        role: 'user',
        content: 'Help me plan revenue strategy for Q1',
        timestamp: '2026-02-20T16:30:00Z',
      },
      {
        id: 'msg-5-2',
        role: 'ai',
        content: `Great question! Based on your connected data from **HubSpot**, **Stripe**, **QuickBooks**, and **ClickUp**:\n\nYour business is performing **above average** in most areas. Key highlights:\n- **MRR**: $32,450 (\u219112.5% MoM)\n- **Customer count**: 127 (\u21915 this month)\n- **Active projects**: 12 (3 on track, 1 at risk)\n- **Team utilization**: 78%\n\nI'd recommend focusing on improving your pipeline coverage from 2.8x to 3x+ to ensure sustained growth.`,
        timestamp: '2026-02-20T16:30:22Z',
        suggestedFollowups: [
          'Set a goal for pipeline coverage',
          'Show me customer trends',
          'Compare to last quarter',
        ],
      },
    ],
  },
];
