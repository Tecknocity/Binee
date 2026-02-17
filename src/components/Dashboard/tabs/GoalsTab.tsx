import React, { useState } from 'react';
import { Target, Plus, TrendingUp, TrendingDown, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Goal } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface GoalsTabProps {
  goals: Goal[];
  onAddGoalClick: () => void;
}

const AI_SUGGESTED_GOALS = [
  { name: 'Reach $50K MRR by Q3', target: '$50,000 MRR', reasoning: 'Based on your 12.5% MoM growth, you could reach $50K MRR by Q3 2026.', impact: 'High' },
  { name: 'Reduce churn to under 2%', target: '< 2% monthly churn', reasoning: 'Your current 3.2% churn is above industry average. Reducing it would add $12K ARR.', impact: 'High' },
  { name: 'Complete 200 tasks per month', target: '200 tasks/month', reasoning: 'Your team averages 156/month. A 28% increase is achievable with better prioritization.', impact: 'Medium' },
];

export const GoalsTab: React.FC<GoalsTabProps> = ({ goals, onAddGoalClick }) => {
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);

  const onTrack = goals.filter(g => g.status === 'on-track').length;
  const atRisk = goals.filter(g => g.status === 'at-risk').length;
  const behind = 0;

  return (
    <div role="tabpanel" id="goals-panel" className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Target size={24} className="text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Business Goals</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track progress toward your key objectives</p>
          </div>
        </div>
        <button
          onClick={onAddGoalClick}
          className="flex items-center gap-2 px-5 py-3 rounded-xl gradient-primary text-white text-sm font-semibold transition-all hover:shadow-glow hover:opacity-90"
        >
          <Plus size={18} /> Add New Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5 border-l-[3px] border-l-success">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">On Track</div>
          <div className="text-4xl font-bold text-success">{onTrack}</div>
        </div>
        <div className="glass rounded-xl p-5 border-l-[3px] border-l-warning">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">At Risk</div>
          <div className="text-4xl font-bold text-warning">{atRisk}</div>
        </div>
        <div className="glass rounded-xl p-5 border-l-[3px] border-l-destructive">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Behind</div>
          <div className="text-4xl font-bold text-destructive">{behind}</div>
        </div>
      </div>

      {/* Active Goals */}
      <div className="space-y-5">
        {goals.map((goal, i) => {
          const progress = (goal.current / goal.target) * 100;
          const isOnTrack = goal.status === 'on-track';
          const isExpanded = expandedGoal === i;

          return (
            <div key={i} className="glass rounded-2xl p-6 card-hover">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-1">{goal.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Target: {goal.unit === 'USD' ? `$${(goal.target / 1000).toFixed(0)}K` : `${goal.target} ${goal.unit}`}
                  </p>
                </div>
                <span className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold",
                  isOnTrack ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                )}>
                  {isOnTrack ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {isOnTrack ? 'On Track' : 'At Risk'}
                </span>
              </div>

              <div className="flex items-end justify-between mb-4">
                <span className="text-4xl font-bold text-foreground">
                  {goal.unit === 'USD' ? `$${(goal.current / 1000).toFixed(0)}K` : goal.current}
                </span>
                <span className={cn("text-2xl font-bold", isOnTrack ? "text-success" : "text-warning")}>
                  {progress.toFixed(0)}%
                </span>
              </div>

              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden mb-4">
                <div
                  className={cn("h-full rounded-full transition-all duration-700 ease-out", isOnTrack ? "bg-success" : "bg-warning")}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              {/* Expandable detail */}
              <button
                onClick={() => setExpandedGoal(isExpanded ? null : i)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Data Sources:</span>
                      <p className="font-medium text-foreground mt-1">HubSpot, Stripe</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium text-foreground mt-1">Jan 15, 2026</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {isOnTrack
                      ? 'At current trajectory, you\'ll reach this goal ahead of schedule.'
                      : 'Growth has slowed. Consider adjusting strategy to get back on track.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI-Suggested Goals */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Lightbulb size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI-Suggested Goals</h3>
            <p className="text-xs text-muted-foreground">Recommendations based on your business data</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_SUGGESTED_GOALS.map((goal, i) => (
            <div key={i} className="bg-background/50 rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-all">
              <h4 className="text-base font-semibold text-foreground mb-2">{goal.name}</h4>
              <p className="text-xs text-muted-foreground mb-3">Target: {goal.target}</p>
              <p className="text-sm text-muted-foreground mb-4">{goal.reasoning}</p>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  goal.impact === 'High' ? 'bg-accent/15 text-accent' : 'bg-info/15 text-info'
                )}>
                  {goal.impact} Impact
                </span>
                <button
                  onClick={onAddGoalClick}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Plus size={14} /> Add Goal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
