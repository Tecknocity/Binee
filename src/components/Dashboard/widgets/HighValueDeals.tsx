import React from 'react';
import { Trophy, Building2 } from 'lucide-react';
import { HighValueDeal } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface HighValueDealsProps {
  deals: HighValueDeal[];
}

export const HighValueDeals: React.FC<HighValueDealsProps> = ({ deals }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
          <Trophy size={20} className="text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">High-Value Deals</h3>
          <p className="text-xs text-muted-foreground">Top opportunities in pipeline</p>
        </div>
      </div>
      
      {/* Header Row */}
      <div className="hidden md:grid grid-cols-6 gap-4 px-4 pb-3 text-xs text-muted-foreground uppercase tracking-wide border-b border-border/50 mb-3">
        <div className="col-span-2">Company</div>
        <div className="text-center">Value</div>
        <div className="text-center">Stage</div>
        <div className="text-center">Probability</div>
        <div className="text-center">Status</div>
      </div>
      
      <div className="space-y-3">
        {deals.map((deal, i) => (
          <div 
            key={i} 
            className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-background/50 rounded-xl border border-border/50 items-center transition-all duration-200 hover:border-warning/30"
          >
            {/* Company */}
            <div className="col-span-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center">
                <Building2 size={16} className="text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">{deal.company}</span>
            </div>
            
            {/* Value */}
            <div className="text-center">
              <span className="text-base font-bold text-success">${(deal.value / 1000).toFixed(0)}K</span>
            </div>
            
            {/* Stage */}
            <div className="text-center">
              <span className="text-sm text-foreground">{deal.stage}</span>
            </div>
            
            {/* Probability */}
            <div className="text-center">
              <span className="text-sm text-foreground">{deal.probability}%</span>
              <div className="w-full h-1 bg-secondary rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${deal.probability}%` }}
                />
              </div>
            </div>
            
            {/* Status */}
            <div className="text-center">
              <span className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold",
                deal.status === 'Active' 
                  ? "bg-success/15 text-success" 
                  : "bg-warning/15 text-warning"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  deal.status === 'Active' ? "bg-success animate-pulse" : "bg-warning"
                )} />
                {deal.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
