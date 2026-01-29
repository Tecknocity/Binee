import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TaskTrend } from '../../../types/dashboard';
import { theme, tooltipStyle } from '../../../styles/theme';

interface TaskCompletionTrendProps {
  data: TaskTrend[];
}

export const TaskCompletionTrend: React.FC<TaskCompletionTrendProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Task Completion Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chartGrid} />
          <XAxis dataKey="week" stroke={theme.colors.chartText} />
          <YAxis stroke={theme.colors.chartText} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="completed" name="Completed" stroke={theme.colors.success} strokeWidth={2} dot={{ fill: theme.colors.success }} />
          <Line type="monotone" dataKey="created" name="Created" stroke={theme.colors.info} strokeWidth={2} dot={{ fill: theme.colors.info }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
