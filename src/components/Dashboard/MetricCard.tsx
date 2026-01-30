import React from 'react';
import { MetricCardProps } from '../../types/dashboard';
import { cn } from '@/lib/utils';

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color, topBorder }) => {
  // Map legacy color strings to semantic classes
  const getColorClasses = (colorValue: string) => {
    if (colorValue.includes('success') || colorValue.includes('160')) {
      return { bg: 'bg-success/15', icon: 'text-success', border: 'border-t-success' };
    }
    if (colorValue.includes('primary') || colorValue.includes('258')) {
      return { bg: 'bg-primary/15', icon: 'text-primary', border: 'border-t-primary' };
    }
    if (colorValue.includes('info') || colorValue.includes('239')) {
      return { bg: 'bg-info/15', icon: 'text-info', border: 'border-t-info' };
    }
    if (colorValue.includes('accent') || colorValue.includes('24 95')) {
      return { bg: 'bg-accent/15', icon: 'text-accent', border: 'border-t-accent' };
    }
    return { bg: 'bg-primary/15', icon: 'text-primary', border: 'border-t-primary' };
  };

  const colors = getColorClasses(color);
  const borderColors = topBorder ? getColorClasses(topBorder) : colors;

  return (
    <div className={cn(
      "relative glass rounded-2xl p-6 card-hover overflow-hidden",
      "border-t-[3px]",
      borderColors.border
    )}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative">
        <div className="flex justify-between items-start mb-5">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 hover:scale-110",
            colors.bg
          )}>
            <Icon size={22} className={colors.icon} />
          </div>
        </div>
        
        <div className="text-4xl font-bold text-foreground mb-1.5 tracking-tight">
          {value}
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground/70 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
