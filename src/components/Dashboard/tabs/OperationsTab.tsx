import React from 'react';
import { Briefcase } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { WidgetWrapper } from '../WidgetWrapper';
import { ProjectHealth } from '../widgets/ProjectHealth';
import { TeamPerformance } from '../widgets/TeamPerformance';
import { TaskCompletionTrend } from '../widgets/TaskCompletionTrend';
import { TeamCapacityUtilization } from '../widgets/TeamCapacityUtilization';

interface OperationsTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

export const OperationsTab: React.FC<OperationsTabProps> = ({ data, overviewWidgets, onToggleWidget }) => {
  return (
    <div role="tabpanel" id="operations-panel" aria-labelledby="operations-tab" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Briefcase size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Operations & Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Project health, team performance, and capacity utilization</p>
        </div>
      </div>

      {/* Project Health */}
      <WidgetWrapper widgetId="projectHealth" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
        <ProjectHealth projects={data.projects} />
      </WidgetWrapper>

      {/* Team Performance + Task Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WidgetWrapper widgetId="teamPerformance" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <TeamPerformance data={data.teamPerformance} />
        </WidgetWrapper>
        <WidgetWrapper widgetId="taskCompletionTrend" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <TaskCompletionTrend data={data.taskCompletionTrend} />
        </WidgetWrapper>
      </div>

      {/* Capacity Utilization */}
      <WidgetWrapper widgetId="teamCapacityUtilization" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
        <TeamCapacityUtilization data={data.teamCapacityUtilization} />
      </WidgetWrapper>
    </div>
  );
};
