import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExpenseCategory } from '../../../types/dashboard';
import { theme, tooltipStyle } from '../../../styles/theme';

interface ExpenseBreakdownProps {
  data: ExpenseCategory[];
}

export const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Expense Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chartGrid} />
          <XAxis type="number" stroke={theme.colors.chartText} />
          <YAxis dataKey="category" type="category" stroke={theme.colors.chartText} width={100} />
          <Tooltip formatter={(value: number) => `$${(value / 1000).toFixed(1)}K`} contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill={theme.colors.danger} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
