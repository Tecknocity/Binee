import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { GitBranch } from 'lucide-react';
import { PipelineStage, ViewMode } from '../../../types/dashboard';

interface SalesPipelineProps {
  data: PipelineStage[];
  viewMode: ViewMode;
}

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 10%)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
};

export const SalesPipeline: React.FC<SalesPipelineProps> = ({ data, viewMode }) => {
  const isCompanyView = viewMode === 'company';
  
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <GitBranch size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Sales Pipeline 
            <span className="text-sm text-muted-foreground font-normal ml-2">
              ({isCompanyView ? 'Company' : 'Binee'})
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">Value by stage</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: isCompanyView ? 60 : 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" vertical={false} />
          <XAxis 
            dataKey="stage" 
            stroke="hsl(215 20% 65%)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            angle={isCompanyView ? -45 : 0} 
            textAnchor={isCompanyView ? 'end' : 'middle'}
          />
          <YAxis 
            stroke="hsl(215 20% 65%)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value/1000}k`}
          />
          <Tooltip 
            contentStyle={tooltipStyle} 
            formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`}
            labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(215 20% 65%)' }}
            cursor={{ fill: 'hsl(217 33% 17% / 0.3)' }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`hsl(${220 + index * 20}, 70%, ${55 - index * 3}%)`} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
