import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RevenueData } from '../../../types/dashboard';
import { theme, tooltipStyle, chartColors } from '../../../styles/theme';

interface RevenueTrendProps {
  data: RevenueData[];
}

export const RevenueTrend: React.FC<RevenueTrendProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Revenue, Expenses & Profit</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chartGrid} />
          <XAxis dataKey="month" stroke={theme.colors.chartText} />
          <YAxis stroke={theme.colors.chartText} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill={chartColors.revenue} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="Profit" fill={chartColors.profit} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
