'use client';

import { CheckSquare, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

const iconMap: Record<string, typeof CheckSquare> = {
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Zap,
};

interface SummaryCardWidgetProps {
  title: string;
  config: Record<string, unknown>;
}

export default function SummaryCardWidget({ title, config }: SummaryCardWidgetProps) {
  const value = config.value as number;
  const change = config.change as number;
  const changeDirection = config.changeDirection as 'up' | 'down';
  const suffix = (config.suffix as string) ?? '';
  const iconName = (config.icon as string) ?? 'CheckSquare';
  const Icon = iconMap[iconName] ?? CheckSquare;

  // For "overdue" cards, down is positive (fewer overdue)
  const isOverdue = title.toLowerCase().includes('overdue');
  const isPositiveChange = isOverdue
    ? changeDirection === 'down'
    : changeDirection === 'up';

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="rounded-xl bg-accent/10 p-3">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <div>
        <p className="text-3xl font-bold text-text-primary">
          {typeof value === 'number'
            ? value % 1 !== 0
              ? value.toFixed(1)
              : value
            : value}
          {suffix && <span className="text-lg font-medium text-text-secondary ml-0.5">{suffix}</span>}
        </p>
        <p className="text-sm text-text-secondary mt-0.5">{title}</p>
        {change !== undefined && (
          <p
            className={`text-xs mt-1 font-medium ${
              isPositiveChange ? 'text-success' : 'text-error'
            }`}
          >
            {changeDirection === 'up' ? '+' : ''}
            {change}
            {suffix === '%' ? ' pts' : ''} vs last week
          </p>
        )}
      </div>
    </div>
  );
}
