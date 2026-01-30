import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { TaskTrend } from '../../../types/dashboard';

interface TaskCompletionTrendProps {
  data: TaskTrend[];
}

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 10%)',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px hsl(222 47% 6% / 0.6)',
};

export const TaskCompletionTrend: React.FC<TaskCompletionTrendProps> = ({ data }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
          <TrendingUp size={20} className="text-success" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Task Completion Trend</h3>
          <p className="text-xs text-muted-foreground">Created vs completed</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" vertical={false} />
          <XAxis 
            dataKey="week" 
            stroke="hsl(215 20% 65%)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="hsl(215 20% 65%)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600, marginBottom: 8 }}
            itemStyle={{ color: 'hsl(215 20% 65%)', fontSize: 13 }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: 20 }}
            iconType="circle"
            iconSize={8}
          />
          <Line 
            type="monotone" 
            dataKey="completed" 
            name="Completed" 
            stroke="hsl(160 84% 39%)" 
            strokeWidth={2.5} 
            dot={{ fill: 'hsl(160 84% 39%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line 
            type="monotone" 
            dataKey="created" 
            name="Created" 
            stroke="hsl(239 84% 67%)" 
            strokeWidth={2.5} 
            dot={{ fill: 'hsl(239 84% 67%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
