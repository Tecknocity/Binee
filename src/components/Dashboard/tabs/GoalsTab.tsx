import React from 'react';
import { Target, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Goal } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface GoalsTabProps {
  goals: Goal[];
  onAddGoalClick: () => void;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({ goals, onAddGoalClick }) => {
  return (
    <div role="tabpanel" id="goals-panel" aria-labelledby="goals-tab" className="space-y-8">
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
          className="flex items-center gap-2 px-5 py-3 rounded-xl gradient-primary text-white text-sm font-semibold transition-all duration-200 hover:shadow-glow hover:opacity-90"
        >
          <Plus size={18} /> Add New Goal
        </button>
      </div>

      {/* Goals List */}
      <div className="space-y-5">
        {goals.map((goal, i) => {
          const progress = (goal.current / goal.target) * 100;
          const isOnTrack = goal.status === 'on-track';
          
          return (
            <div 
              key={i} 
              className="glass rounded-2xl p-6 card-hover"
            >
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
                <span className={cn(
                  "text-2xl font-bold",
                  isOnTrack ? "text-success" : "text-warning"
                )}>
                  {progress.toFixed(0)}%
                </span>
              </div>
              
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    isOnTrack ? "bg-success" : "bg-warning"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
