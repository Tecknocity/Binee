import React from 'react';
import { Calculator, TrendingUp, Users, Target, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const MATRIX_ROWS = [
  { segment: 'Enterprise', current: '--', optimal: '--', gap: '--' },
  { segment: 'Mid-Market', current: '--', optimal: '--', gap: '--' },
  { segment: 'SMB', current: '--', optimal: '--', gap: '--' },
  { segment: 'Startup', current: '--', optimal: '--', gap: '--' },
];

const PriceArchitectPage: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Calculator size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Price Architect</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Data-driven pricing optimization</p>
        </div>
      </div>

      {/* Description Card */}
      <div className="glass rounded-2xl p-6 mb-8 border-l-[3px] border-l-primary">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Analyze your pricing against market data, customer segments, and revenue goals to find your optimal price point.
        </p>
      </div>

      {/* Key Metrics Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Revenue Impact', icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Customer Segments', icon: Users, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Price Points', icon: Target, color: 'text-warning', bg: 'bg-warning/10' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="glass rounded-2xl p-6 opacity-50">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", metric.bg)}>
                  <Icon size={20} className={metric.color} />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{metric.label}</h3>
              </div>
              <div className="text-3xl font-bold text-muted-foreground/30">--</div>
            </div>
          );
        })}
      </div>

      {/* Pricing Matrix Placeholder */}
      <div className="glass rounded-2xl p-6 mb-8 opacity-50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Pricing Matrix</h3>
        <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
            <div>Segment</div>
            <div>Current Price</div>
            <div>Optimal Price</div>
            <div>Revenue Gap</div>
          </div>
          {/* Table Rows */}
          {MATRIX_ROWS.map((row) => (
            <div key={row.segment} className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 items-center">
              <div className="text-sm font-medium text-foreground">{row.segment}</div>
              <div className="text-sm text-muted-foreground">{row.current}</div>
              <div className="text-sm text-muted-foreground">{row.optimal}</div>
              <div className="text-sm text-muted-foreground">{row.gap}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="glass rounded-2xl p-8 opacity-50 mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Price Sensitivity Curve</h3>
        <div className="h-48 flex items-center justify-center border border-dashed border-border/50 rounded-xl">
          <p className="text-sm text-muted-foreground">Chart visualization will appear here</p>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <div className="relative group">
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted text-muted-foreground text-sm font-semibold cursor-not-allowed"
          >
            <Lock size={16} />
            Start Analysis
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Connect integrations to get started
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceArchitectPage;
