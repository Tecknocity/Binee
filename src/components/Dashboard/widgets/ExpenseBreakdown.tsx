import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CreditCard } from 'lucide-react';
import { ExpenseCategory } from '../../../types/dashboard';

interface ExpenseBreakdownProps {
  data: ExpenseCategory[];
}

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 10%)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
};

export const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
          <CreditCard size={20} className="text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Expense Breakdown</h3>
          <p className="text-xs text-muted-foreground">Cost distribution by category</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            stroke="hsl(215 20% 65%)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value/1000}k`}
          />
          <YAxis 
            dataKey="category" 
            type="category" 
            stroke="hsl(215 20% 65%)" 
            width={90}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            formatter={(value: number) => `$${(value / 1000).toFixed(1)}K`} 
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(215 20% 65%)' }}
            cursor={{ fill: 'hsl(217 33% 17% / 0.3)' }}
          />
          <Bar 
            dataKey="value" 
            fill="hsl(0 84% 60%)" 
            radius={[0, 6, 6, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
