import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { RevenueData } from '../../../types/dashboard';

interface RevenueTrendProps {
  data: RevenueData[];
}

const CHART_COLORS = {
  revenue: 'hsl(160 84% 39%)',
  expenses: 'hsl(0 84% 60%)',
  profit: 'hsl(239 84% 67%)',
  grid: 'hsl(217 33% 20%)',
  text: 'hsl(215 20% 65%)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 10%)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
};

export const RevenueTrend: React.FC<RevenueTrendProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
          <TrendingUp size={20} className="text-success" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
          <p className="text-xs text-muted-foreground">Revenue, expenses & profit</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke={CHART_COLORS.text} 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke={CHART_COLORS.text} 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value/1000}k`}
          />
          <Tooltip 
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600, marginBottom: 8 }}
            itemStyle={{ color: 'hsl(215 20% 65%)', fontSize: 13 }}
            cursor={{ fill: 'hsl(217 33% 17% / 0.3)' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: 20 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar 
            dataKey="revenue" 
            name="Revenue" 
            fill={CHART_COLORS.revenue} 
            radius={[6, 6, 0, 0]} 
          />
          <Bar 
            dataKey="expenses" 
            name="Expenses" 
            fill={CHART_COLORS.expenses} 
            radius={[6, 6, 0, 0]} 
          />
          <Bar 
            dataKey="profit" 
            name="Profit" 
            fill={CHART_COLORS.profit} 
            radius={[6, 6, 0, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
