'use client';

import {
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Clock,
  BarChart3,
  Target,
  Activity,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Clock,
  BarChart3,
  Target,
  Activity,
};

interface SummaryCardWidgetConfig {
  value?: number | string;
  change?: number;
  changeDirection?: 'up' | 'down';
  suffix?: string;
  prefix?: string;
  icon?: string;
  changeLabel?: string;
  valueColor?: string;
}

interface SummaryCardWidgetProps {
  title: string;
  config: SummaryCardWidgetConfig;
}

export default function SummaryCardWidget({ title, config }: SummaryCardWidgetProps) {
  const value = config.value as number | string | undefined;
  const change = config.change as number | undefined;
  const changeDirection = (config.changeDirection as 'up' | 'down') ?? undefined;
  const suffix = (config.suffix as string) ?? '';
  const prefix = (config.prefix as string) ?? '';
  const iconName = (config.icon as string) ?? 'CheckSquare';
  const changeLabel = (config.changeLabel as string) ?? 'vs last week';
  const Icon = iconMap[iconName] ?? CheckSquare;

  // For "overdue" cards, down is positive (fewer overdue)
  const isOverdue = title.toLowerCase().includes('overdue');
  const isPositiveChange = isOverdue
    ? changeDirection === 'down'
    : changeDirection === 'up';

  // Format the display value
  const displayValue = typeof value === 'number'
    ? value % 1 !== 0
      ? value.toFixed(1)
      : value
    : value ?? '—';

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="rounded-xl bg-accent/10 p-3">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <div>
        <p className="text-3xl font-bold text-text-primary" style={config.valueColor ? { color: config.valueColor } : undefined}>
          {prefix && <span className="text-lg font-medium text-text-secondary mr-0.5">{prefix}</span>}
          {displayValue}
          {suffix && <span className="text-lg font-medium text-text-secondary ml-0.5">{suffix}</span>}
        </p>
        <p className="text-sm text-text-secondary mt-0.5">{title}</p>
        {change !== undefined && changeDirection && (
          <p
            className={`text-xs mt-1 font-medium ${
              isPositiveChange ? 'text-success' : 'text-error'
            }`}
          >
            {changeDirection === 'up' ? '+' : ''}
            {change}
            {suffix === '%' ? ' pts' : ''} {changeLabel}
          </p>
        )}
      </div>
    </div>
  );
}
