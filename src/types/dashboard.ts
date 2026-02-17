import { LucideIcon } from 'lucide-react';

export interface Metrics {
  cash: number;
  mrr: number;
  customers: number;
  projects: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  profitMargin: number;
  profitAmount: number;
  pipelineValue: number;
  pipelineDeals: number;
  avgDealSize: number;
  avgDealCycle: number;
}

export interface RevenueSource {
  source: string;
  value: number;
  percentage: number;
}

export interface ExpenseCategory {
  category: string;
  value: number;
}

export interface Prediction {
  title: string;
  prediction: string;
  confidence: number;
  details: string;
}

export interface OperationsMetrics {
  activeProjects: number;
  teamCapacity: number;
  tasksCompleted: number;
  overdueTasks: number;
}

export interface Project {
  name: string;
  status: 'on-track' | 'at-risk' | 'delayed';
  progress: number;
  budget: number;
  spent: number;
  dueIn: number;
}

export interface TeamMember {
  member: string;
  tasksCompleted: number;
  hoursLogged: number;
}

export interface TaskTrend {
  week: string;
  completed: number;
  created: number;
}

export interface CapacityUtilization {
  member: string;
  utilization: number;
}

export interface Goal {
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'on-track' | 'at-risk';
}

export type IssueSeverity = 'high' | 'warning' | 'improvement';
export type IssueStatus = 'not-fixed' | 'in-progress' | 'dismissed' | 'suggested';

export interface Issue {
  category: string;
  severity: IssueSeverity;
  title: string;
  impact: string;
  source: string;
  affects?: string;
  action: string;
  fixAction: string;
  status: IssueStatus;
  impactAmount?: string;
}

export interface IssuesData {
  lastAnalyzed: string;
  items: Issue[];
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  title: string;
  reasoning: string;
  impact: string;
  effort: string;
  action: string;
}

export interface PipelineStage {
  stage: string;
  count: number;
  value?: number;
}

export interface HighValueDeal {
  company: string;
  value: number;
  stage: string;
  probability: number;
  daysInStage: number;
  status: 'Active' | 'Stuck';
}

export interface StageMapping {
  order: number;
  theirStage: string;
  ourStage: string;
}

export interface StatusMapping {
  order: number;
  theirStatus: string;
  ourStatus: string;
}

export interface DataMapping {
  crm: {
    mapped: boolean;
    lastUpdated: string;
    stages: StageMapping[];
  };
  projectManagement: {
    mapped: boolean;
    lastUpdated: string;
    statuses: StatusMapping[];
  };
}

export interface Gamification {
  totalScore: number;
  pointsToNextLevel: number;
}

export interface MockData {
  metrics: Metrics;
  revenue: RevenueData[];
  revenueMetrics: RevenueMetrics;
  revenueBySource: RevenueSource[];
  expenseBreakdown: ExpenseCategory[];
  predictions: Prediction[];
  operationsMetrics: OperationsMetrics;
  projects: Project[];
  teamPerformance: TeamMember[];
  taskCompletionTrend: TaskTrend[];
  teamCapacityUtilization: CapacityUtilization[];
  goals: Goal[];
  issues: IssuesData;
  suggestions: Suggestion[];
  pipeline: PipelineStage[];
  companyPipeline: PipelineStage[];
  companyDealCount: PipelineStage[];
  highValueDeals: HighValueDeal[];
  dataMapping: DataMapping;
  gamification: Gamification;
}

export type TabId = 'home' | 'goals' | 'growth' | 'operations' | 'insights' | 'actions';
export type ViewMode = 'company' | 'binee';

export type WidgetId =
  | 'metrics'
  | 'aiInsights'
  | 'revenueTrend'
  | 'revenueBySource'
  | 'expenseBreakdown'
  | 'salesPipeline'
  | 'dealCountByStage'
  | 'highValueDeals'
  | 'projectHealth'
  | 'teamPerformance'
  | 'taskCompletionTrend'
  | 'teamCapacityUtilization';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: string;
  topBorder?: string;
}

export interface WidgetWrapperProps {
  widgetId: WidgetId;
  children: React.ReactNode;
  overviewWidgets: WidgetId[];
  onToggle: (widgetId: WidgetId) => void;
}

export interface NewGoal {
  name: string;
  target: string;
  unit: string;
}
