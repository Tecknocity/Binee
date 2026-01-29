import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { RevenueSource } from '../../../types/dashboard';
import { theme, tooltipStyle } from '../../../styles/theme';

interface RevenueBySourceProps {
  data: RevenueSource[];
}

const COLORS = [theme.colors.success, theme.colors.info, theme.colors.warning];

export const RevenueBySource: React.FC<RevenueBySourceProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Revenue by Source</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" labelLine={false} label={({ source, percentage }) => `${source} (${percentage}%)`} outerRadius={100} fill="#8884d8" dataKey="value">
            {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
