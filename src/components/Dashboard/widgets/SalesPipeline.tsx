import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { PipelineStage, ViewMode } from '../../../types/dashboard';
import { theme, tooltipStyle } from '../../../styles/theme';

interface SalesPipelineProps {
  data: PipelineStage[];
  viewMode: ViewMode;
}

export const SalesPipeline: React.FC<SalesPipelineProps> = ({ data, viewMode }) => {
  const isCompanyView = viewMode === 'company';
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.sm, color: theme.colors.text }}>Sales Pipeline by Stage <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.normal }}>({isCompanyView ? 'Company' : 'Binee'} View)</span></h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chartGrid} />
          <XAxis dataKey="stage" stroke={theme.colors.chartText} angle={isCompanyView ? -45 : 0} textAnchor={isCompanyView ? 'end' : 'middle'} height={isCompanyView ? 120 : 60} />
          <YAxis stroke={theme.colors.chartText} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`} />
          <Bar dataKey="value" fill={theme.colors.info} radius={[8, 8, 0, 0]}>
            {data.map((_, index) => <Cell key={`cell-${index}`} fill={`hsl(${180 + index * 15}, 70%, ${55 - index * 2}%)`} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
