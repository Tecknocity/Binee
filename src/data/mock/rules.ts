export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  severity: RuleSeverity;
  description: string;
  metric: string;
  operator: string;
  threshold: number;
  defaultThreshold: number;
  unit: string;
  window: string;
  isActive: boolean;
  notify: boolean;
  source: 'default' | 'custom';
  status: 'monitoring' | 'triggered' | 'disabled';
  suggestedActions: string[];
}

export type RuleCategory = 'revenue' | 'operations' | 'financial_health' | 'customer' | 'cross_tool';
export type RuleSeverity = 'critical' | 'warning' | 'info';

export const CATEGORY_CONFIG: Record<RuleCategory, { label: string; color: string; bgClass: string; textClass: string }> = {
  revenue: { label: 'Revenue', color: 'green', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400' },
  operations: { label: 'Operations', color: 'blue', bgClass: 'bg-blue-500/15', textClass: 'text-blue-400' },
  financial_health: { label: 'Financial', color: 'orange', bgClass: 'bg-orange-500/15', textClass: 'text-orange-400' },
  customer: { label: 'Customer', color: 'purple', bgClass: 'bg-purple-500/15', textClass: 'text-purple-400' },
  cross_tool: { label: 'Cross-tool', color: 'red', bgClass: 'bg-red-500/15', textClass: 'text-red-400' },
};

export const SEVERITY_CONFIG: Record<RuleSeverity, { label: string; bgClass: string; textClass: string }> = {
  critical: { label: 'Critical', bgClass: 'bg-destructive/15', textClass: 'text-destructive' },
  warning: { label: 'Warning', bgClass: 'bg-warning/15', textClass: 'text-warning' },
  info: { label: 'Info', bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
};

export const mockRules: Rule[] = [
  // Revenue & Growth (6)
  {
    id: 'r1', name: 'MRR Drop Alert', category: 'revenue', severity: 'critical',
    description: 'MRR decreased month-over-month', metric: 'mrr_change_mom',
    operator: 'change_exceeds', threshold: 10, defaultThreshold: 10, unit: '%',
    window: 'month_over_month', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Review recent churn', 'Check failed payments', 'Analyze downgrade patterns'],
  },
  {
    id: 'r2', name: 'Sustained Churn', category: 'revenue', severity: 'critical',
    description: 'Churn rate high for consecutive months', metric: 'churn_rate',
    operator: 'consecutive_periods', threshold: 5, defaultThreshold: 5, unit: '%',
    window: 'consecutive_2_months', isActive: true, notify: true, source: 'default',
    status: 'triggered', suggestedActions: ['Run churn analysis', 'Review customer health scores', 'Implement win-back campaign'],
  },
  {
    id: 'r3', name: 'Pipeline Coverage', category: 'revenue', severity: 'warning',
    description: 'Pipeline value vs. monthly revenue target', metric: 'pipeline_coverage',
    operator: 'less_than', threshold: 3, defaultThreshold: 3, unit: 'x',
    window: 'current', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Increase outbound activity', 'Review lead sources', 'Accelerate deal progression'],
  },
  {
    id: 'r4', name: 'Deal Velocity Slowdown', category: 'revenue', severity: 'warning',
    description: 'Average deal cycle increasing', metric: 'deal_cycle_days',
    operator: 'change_exceeds', threshold: 20, defaultThreshold: 20, unit: '%',
    window: 'month_over_month', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Review sales process stages', 'Identify bottleneck stages', 'Coach on objection handling'],
  },
  {
    id: 'r5', name: 'Pipeline Drought', category: 'revenue', severity: 'warning',
    description: 'No new deals entered pipeline', metric: 'new_deals_count',
    operator: 'equals', threshold: 14, defaultThreshold: 14, unit: 'days',
    window: 'trailing_days', isActive: false, notify: false, source: 'default',
    status: 'disabled', suggestedActions: ['Review marketing campaigns', 'Check lead gen channels', 'Activate outbound sequence'],
  },
  {
    id: 'r6', name: 'Revenue Concentration', category: 'revenue', severity: 'warning',
    description: 'Single client as % of total revenue', metric: 'revenue_concentration',
    operator: 'greater_than', threshold: 30, defaultThreshold: 30, unit: '%',
    window: 'current', isActive: true, notify: true, source: 'default',
    status: 'triggered', suggestedActions: ['Diversify revenue sources', 'Accelerate pipeline deals', 'Negotiate longer contracts with key client'],
  },

  // Operations (4)
  {
    id: 'r7', name: 'Task Overdue Rate', category: 'operations', severity: 'warning',
    description: 'Overdue tasks as % of active tasks', metric: 'overdue_rate',
    operator: 'greater_than', threshold: 25, defaultThreshold: 25, unit: '%',
    window: 'current', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Reprioritize backlog', 'Review team capacity', 'Break down large tasks'],
  },
  {
    id: 'r8', name: 'Sprint Completion', category: 'operations', severity: 'warning',
    description: 'Sprint/project completion rate', metric: 'sprint_completion',
    operator: 'less_than', threshold: 60, defaultThreshold: 60, unit: '%',
    window: 'current_sprint', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Reduce sprint scope', 'Address blocking issues', 'Review estimation accuracy'],
  },
  {
    id: 'r9', name: 'Task Aging', category: 'operations', severity: 'info',
    description: 'Average task age vs. historical average', metric: 'avg_task_age',
    operator: 'greater_than', threshold: 2, defaultThreshold: 2, unit: 'x average',
    window: 'vs_historical', isActive: false, notify: false, source: 'default',
    status: 'disabled', suggestedActions: ['Archive stale tasks', 'Review task ownership', 'Set task SLAs'],
  },
  {
    id: 'r10', name: 'Team Inactivity', category: 'operations', severity: 'warning',
    description: 'No task activity across team', metric: 'team_activity_gap',
    operator: 'greater_than', threshold: 3, defaultThreshold: 3, unit: 'days',
    window: 'trailing_days', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Check team availability', 'Review tool adoption', 'Schedule team sync'],
  },

  // Financial Health (4)
  {
    id: 'r11', name: 'Burn Rate Exceeds Revenue', category: 'financial_health', severity: 'critical',
    description: 'Monthly burn vs. monthly revenue', metric: 'burn_vs_revenue',
    operator: 'consecutive_periods', threshold: 3, defaultThreshold: 3, unit: 'months',
    window: 'consecutive_months', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Review expense categories', 'Identify cost reduction opportunities', 'Accelerate revenue initiatives'],
  },
  {
    id: 'r12', name: 'Expense Growth Outpacing Revenue', category: 'financial_health', severity: 'critical',
    description: 'Expense growth rate vs. revenue growth rate', metric: 'expense_vs_revenue_growth',
    operator: 'consecutive_periods', threshold: 3, defaultThreshold: 3, unit: 'months',
    window: 'consecutive_months', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Audit recurring expenses', 'Freeze non-essential hiring', 'Review vendor contracts'],
  },
  {
    id: 'r13', name: 'Cash Runway Alert', category: 'financial_health', severity: 'critical',
    description: 'Months of runway remaining', metric: 'cash_runway_months',
    operator: 'less_than', threshold: 6, defaultThreshold: 6, unit: 'months',
    window: 'current', isActive: true, notify: true, source: 'default',
    status: 'triggered', suggestedActions: ['Begin fundraising process', 'Implement immediate cost cuts', 'Explore bridge financing options'],
  },
  {
    id: 'r14', name: 'Receivables Aging', category: 'financial_health', severity: 'warning',
    description: 'Invoices past due', metric: 'receivables_aging',
    operator: 'greater_than', threshold: 60, defaultThreshold: 60, unit: 'days on 20%+ invoices',
    window: 'current', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Send payment reminders', 'Review payment terms', 'Consider collections process'],
  },

  // Customer (3)
  {
    id: 'r15', name: 'Support Volume Spike', category: 'customer', severity: 'warning',
    description: 'Ticket volume vs. 30-day average', metric: 'support_volume_change',
    operator: 'change_exceeds', threshold: 50, defaultThreshold: 50, unit: '%',
    window: 'vs_30day_avg', isActive: true, notify: false, source: 'default',
    status: 'monitoring', suggestedActions: ['Investigate root cause', 'Check for product issues', 'Review recent deployments'],
  },
  {
    id: 'r16', name: 'Response Time Breach', category: 'customer', severity: 'warning',
    description: 'Response time exceeding SLA', metric: 'response_time_sla',
    operator: 'consecutive_periods', threshold: 3, defaultThreshold: 3, unit: 'consecutive days',
    window: 'trailing_days', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Review support staffing', 'Implement auto-responses', 'Triage ticket priorities'],
  },
  {
    id: 'r17', name: 'Satisfaction Drop', category: 'customer', severity: 'warning',
    description: 'NPS or satisfaction score', metric: 'satisfaction_score',
    operator: 'less_than', threshold: 40, defaultThreshold: 40, unit: 'NPS',
    window: 'current', isActive: false, notify: false, source: 'default',
    status: 'disabled', suggestedActions: ['Run customer interviews', 'Analyze detractor feedback', 'Address top complaints'],
  },

  // Cross-Tool Correlation (3)
  {
    id: 'r18', name: 'Churn Risk Signal', category: 'cross_tool', severity: 'critical',
    description: 'Deal velocity slowing + support tickets rising simultaneously',
    metric: 'churn_risk_composite', operator: 'greater_than', threshold: 1, defaultThreshold: 1,
    unit: 'signals', window: 'current', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Review at-risk accounts', 'Proactive outreach to key customers', 'Align sales and support teams'],
  },
  {
    id: 'r19', name: 'Operational Bottleneck', category: 'cross_tool', severity: 'critical',
    description: 'Revenue dropping + team velocity dropping for 2+ weeks',
    metric: 'ops_bottleneck_composite', operator: 'consecutive_periods', threshold: 2, defaultThreshold: 2,
    unit: 'weeks', window: 'trailing_weeks', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Run all-hands diagnostic', 'Identify blocking dependencies', 'Consider temporary resource allocation'],
  },
  {
    id: 'r20', name: 'Cash Crisis Signal', category: 'cross_tool', severity: 'critical',
    description: 'Burn rate increasing + pipeline shrinking for 1+ month',
    metric: 'cash_crisis_composite', operator: 'consecutive_periods', threshold: 1, defaultThreshold: 1,
    unit: 'months', window: 'trailing_months', isActive: true, notify: true, source: 'default',
    status: 'monitoring', suggestedActions: ['Emergency financial review', 'Pause non-critical spending', 'Accelerate revenue-generating activities'],
  },
];
