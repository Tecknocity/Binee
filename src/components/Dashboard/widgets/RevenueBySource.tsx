import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChartIcon } from 'lucide-react';
import { RevenueSource } from '../../../types/dashboard';

interface RevenueBySourceProps {
  data: RevenueSource[];
}

const COLORS = ['hsl(160 84% 39%)', 'hsl(239 84% 67%)', 'hsl(38 92% 50%)'];

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 10%)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
};

export const RevenueBySource: React.FC<RevenueBySourceProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center">
          <PieChartIcon size={20} className="text-info" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Revenue by Source</h3>
          <p className="text-xs text-muted-foreground">Distribution breakdown</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie 
            data={data} 
            cx="50%" 
            cy="50%" 
            labelLine={false} 
            label={({ source, percentage }) => `${source} (${percentage}%)`} 
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`} 
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(215 20% 65%)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
