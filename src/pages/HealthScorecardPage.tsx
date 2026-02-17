import React from 'react';
import { HeartPulse, DollarSign, Briefcase, Users, ThumbsUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const DIMENSIONS = [
  { label: 'Revenue', icon: DollarSign, score: '--', color: 'text-success', bg: 'bg-success/10' },
  { label: 'Operations', icon: Briefcase, score: '--', color: 'text-warning', bg: 'bg-warning/10' },
  { label: 'Team', icon: Users, score: '--', color: 'text-info', bg: 'bg-info/10' },
  { label: 'Customer', icon: ThumbsUp, score: '--', color: 'text-accent', bg: 'bg-accent/10' },
];

const HealthScorecardPage: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <HeartPulse size={24} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Health Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprehensive health assessment for your business</p>
        </div>
      </div>

      {/* Description Card */}
      <div className="glass rounded-2xl p-6 mb-8 border-l-[3px] border-l-accent">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This tool analyzes data from all your connected integrations to generate a comprehensive health score across Revenue, Operations, Team, and Customer dimensions.
        </p>
      </div>

      {/* Scorecard Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          return (
            <div key={dim.label} className="glass rounded-2xl p-6 opacity-50">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", dim.bg)}>
                  <Icon size={20} className={dim.color} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{dim.label}</h3>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold text-muted-foreground/40">{dim.score}</span>
                <span className="text-sm text-muted-foreground/40 mb-1">/ 100</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-muted-foreground/20 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Score Placeholder */}
      <div className="glass rounded-2xl p-8 text-center opacity-50 mb-8">
        <div className="text-6xl font-bold text-muted-foreground/30 mb-2">--</div>
        <div className="text-sm text-muted-foreground">Overall Health Score</div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center">
        <div className="relative group">
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted text-muted-foreground text-sm font-semibold cursor-not-allowed"
          >
            <Lock size={16} />
            Generate Scorecard
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Connect integrations to get started
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthScorecardPage;
