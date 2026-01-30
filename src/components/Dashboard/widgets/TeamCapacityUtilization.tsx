import React from 'react';
import { Gauge } from 'lucide-react';
import { CapacityUtilization } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface TeamCapacityUtilizationProps {
  data: CapacityUtilization[];
}

const getUtilizationColor = (utilization: number) => {
  if (utilization >= 90) return { text: 'text-success', bg: 'bg-success' };
  if (utilization >= 70) return { text: 'text-warning', bg: 'bg-warning' };
  if (utilization >= 50) return { text: 'text-info', bg: 'bg-info' };
  return { text: 'text-destructive', bg: 'bg-destructive' };
};

export const TeamCapacityUtilization: React.FC<TeamCapacityUtilizationProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
          <Gauge size={20} className="text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Capacity Utilization</h3>
          <p className="text-xs text-muted-foreground">Resource allocation overview</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((member, i) => {
          const colors = getUtilizationColor(member.utilization);
          
          return (
            <div key={i} className="group">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-xs">
                    {member.member.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{member.member}</span>
                </div>
                <span className={cn("text-sm font-bold", colors.text)}>
                  {member.utilization}%
                </span>
              </div>
              
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out group-hover:shadow-glow-sm",
                    colors.bg
                  )}
                  style={{ width: `${member.utilization}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success" />
          90%+ Optimal
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-warning" />
          70-89% Good
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-info" />
          50-69% Fair
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          &lt;50% Low
        </div>
      </div>
    </div>
  );
};
