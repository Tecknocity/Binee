import React, { useState } from 'react';
import { IntegrationCard } from './IntegrationCard';
import type { Integration, IntegrationCategory } from '@/data/mock/integrations';
import { cn } from '@/lib/utils';

type FilterCategory = 'All' | IntegrationCategory;

const FILTER_CATEGORIES: FilterCategory[] = [
  'All',
  'CRM & Sales',
  'Finance & Payments',
  'Project Management',
  'Communication',
];

interface IntegrationGridProps {
  integrations: Integration[];
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
  onSync: (slug: string) => void;
  onManage: (slug: string) => void;
  syncingSlug?: string | null;
}

export const IntegrationGrid: React.FC<IntegrationGridProps> = ({
  integrations,
  onConnect,
  onDisconnect,
  onSync,
  onManage,
  syncingSlug,
}) => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All');

  const filteredIntegrations =
    activeCategory === 'All'
      ? integrations
      : integrations.filter((i) => i.category === activeCategory);

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTER_CATEGORIES.map((category) => {
          const count =
            category === 'All'
              ? integrations.length
              : integrations.filter((i) => i.category === category).length;

          return (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeCategory === category
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {category}
              <span
                className={cn(
                  'ml-2 text-xs',
                  activeCategory === category
                    ? 'text-white/80'
                    : 'text-muted-foreground/60'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSync={onSync}
            onManage={onManage}
            isSyncing={syncingSlug === integration.slug}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No integrations in this category</p>
          <p className="text-sm mt-1">Try selecting a different category filter.</p>
        </div>
      )}
    </div>
  );
};

export default IntegrationGrid;
