import React from 'react';
import { FolderKanban, Clock, DollarSign, Calendar } from 'lucide-react';
import { Project } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface ProjectHealthProps {
  projects: Project[];
}

const statusConfig = {
  'on-track': { 
    bg: 'bg-success/15', 
    color: 'text-success', 
    label: 'On Track',
    progressBg: 'bg-success'
  },
  'at-risk': { 
    bg: 'bg-warning/15', 
    color: 'text-warning', 
    label: 'At Risk',
    progressBg: 'bg-warning'
  },
  'delayed': { 
    bg: 'bg-destructive/15', 
    color: 'text-destructive', 
    label: 'Delayed',
    progressBg: 'bg-destructive'
  },
};

export const ProjectHealth: React.FC<ProjectHealthProps> = ({ projects }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <FolderKanban size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Project Health Status</h3>
          <p className="text-xs text-muted-foreground">Track project progress and budgets</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {projects.map((project, i) => {
          const budgetPercent = (project.spent / project.budget) * 100;
          const status = statusConfig[project.status];
          
          return (
            <div 
              key={i} 
              className="bg-background/50 rounded-xl p-5 border border-border/50 transition-all duration-200 hover:border-primary/30"
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-semibold text-foreground">{project.name}</h4>
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold",
                  status.bg,
                  status.color
                )}>
                  {status.label}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground uppercase mb-1">
                    <Clock size={10} />
                    Progress
                  </div>
                  <div className="text-base font-bold text-foreground">{project.progress}%</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground uppercase mb-1">
                    <DollarSign size={10} />
                    Budget
                  </div>
                  <div className={cn(
                    "text-base font-bold",
                    budgetPercent > 90 ? "text-destructive" : "text-foreground"
                  )}>
                    ${(project.spent / 1000).toFixed(0)}K / ${(project.budget / 1000).toFixed(0)}K
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground uppercase mb-1">
                    <Calendar size={10} />
                    Timeline
                  </div>
                  <div className={cn(
                    "text-base font-bold",
                    project.dueIn < 0 ? "text-destructive" : "text-foreground"
                  )}>
                    {project.dueIn < 0 ? `${Math.abs(project.dueIn)} days overdue` : `${project.dueIn} days left`}
                  </div>
                </div>
              </div>
              
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", status.progressBg)}
                  style={{ width: `${project.progress}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
