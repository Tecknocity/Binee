import React from 'react';
import { Briefcase } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
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
    <div role="tabpanel" id="operations-panel" aria-labelledby="operations-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Briefcase size={28} color={theme.colors.accent} />
        <div>
          <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Operations & Team</h2>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Project health, team performance, and capacity utilization</p>
        </div>
      </div>
      <WidgetWrapper widgetId="projectHealth" overviewWidgets={overviewWidgets} activeTab="operations" onToggle={onToggleWidget}>
        <ProjectHealth projects={data.projects} />
      </WidgetWrapper>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing['xl'] }}>
        <WidgetWrapper widgetId="teamPerformance" overviewWidgets={overviewWidgets} activeTab="operations" onToggle={onToggleWidget}>
          <TeamPerformance data={data.teamPerformance} />
        </WidgetWrapper>
        <WidgetWrapper widgetId="taskCompletionTrend" overviewWidgets={overviewWidgets} activeTab="operations" onToggle={onToggleWidget}>
          <TaskCompletionTrend data={data.taskCompletionTrend} />
        </WidgetWrapper>
      </div>
      <WidgetWrapper widgetId="teamCapacityUtilization" overviewWidgets={overviewWidgets} activeTab="operations" onToggle={onToggleWidget}>
        <TeamCapacityUtilization data={data.teamCapacityUtilization} />
      </WidgetWrapper>
    </div>
  );
};
