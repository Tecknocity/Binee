import React from 'react';
import { Users, CheckCircle2, Clock } from 'lucide-react';
import { TeamMember } from '../../../types/dashboard';

interface TeamPerformanceProps {
  data: TeamMember[];
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center">
          <Users size={20} className="text-info" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Performance</h3>
          <p className="text-xs text-muted-foreground">Individual contributions</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {data.map((member, i) => (
          <div 
            key={i} 
            className="flex justify-between items-center p-4 bg-background/50 rounded-xl border border-border/50 transition-all duration-200 hover:border-info/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
                {member.member.charAt(0)}
              </div>
              <span className="text-sm font-medium text-foreground">{member.member}</span>
            </div>
            
            <div className="flex gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <CheckCircle2 size={10} />
                  Tasks
                </div>
                <div className="text-base font-bold text-success">{member.tasksCompleted}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Clock size={10} />
                  Hours
                </div>
                <div className="text-base font-bold text-info">{member.hoursLogged}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
