import React from 'react';
import {
  Target,
  Cloud,
  CreditCard,
  BookOpen,
  CheckSquare,
  Layout,
  FileText,
  Mail,
  MessageSquare,
  Calendar,
  RefreshCw,
  Settings,
  Unlink,
  ChevronDown,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Integration } from '@/data/mock/integrations';

const ICON_MAP: Record<string, LucideIcon> = {
  Target,
  Cloud,
  CreditCard,
  BookOpen,
  CheckSquare,
  Layout,
  FileText,
  Mail,
  MessageSquare,
  Calendar,
};

const CATEGORY_COLORS: Record<string, string> = {
  'CRM & Sales': 'bg-blue-500',
  'Finance & Payments': 'bg-emerald-500',
  'Project Management': 'bg-violet-500',
  Communication: 'bg-amber-500',
};

interface IntegrationCardProps {
  integration: Integration;
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
  onSync: (slug: string) => void;
  onManage: (slug: string) => void;
  isSyncing?: boolean;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return num.toString();
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  integration,
  onConnect,
  onDisconnect,
  onSync,
  onManage,
  isSyncing = false,
}) => {
  const IconComponent = ICON_MAP[integration.icon] || Database;
  const categoryColor = CATEGORY_COLORS[integration.category] || 'bg-primary';

  return (
    <div
      className={`bg-card rounded-xl border border-border p-5 card-hover ${
        integration.isComingSoon ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`w-11 h-11 rounded-lg ${categoryColor} flex items-center justify-center text-white shrink-0`}
        >
          <IconComponent size={20} />
        </div>

        {/* Name + Badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground truncate">
              {integration.name}
            </h3>
            {integration.isComingSoon ? (
              <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/15">
                Coming Soon
              </Badge>
            ) : integration.isConnected ? (
              <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/15">
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">
                Not Connected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {integration.description}
          </p>
        </div>
      </div>

      {/* Connected Info */}
      {integration.isConnected && integration.lastSyncedAt && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <RefreshCw size={12} />
            <span>Synced {formatRelativeTime(integration.lastSyncedAt)}</span>
          </div>
          {integration.datapointsSynced != null && (
            <div className="flex items-center gap-1.5">
              <Database size={12} />
              <span>{formatNumber(integration.datapointsSynced)} data points</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4">
        {integration.isComingSoon ? (
          <Button variant="outline" className="w-full" disabled>
            Coming Soon
          </Button>
        ) : integration.isConnected ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full">
                Manage
                <ChevronDown size={16} className="ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onSync(integration.slug)}
                disabled={isSyncing}
              >
                <RefreshCw
                  size={14}
                  className={isSyncing ? 'animate-spin' : ''}
                />
                <span className="ml-2">
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManage(integration.slug)}>
                <Settings size={14} />
                <span className="ml-2">Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDisconnect(integration.slug)}
                className="text-destructive focus:text-destructive"
              >
                <Unlink size={14} />
                <span className="ml-2">Disconnect</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            className="w-full gradient-primary text-white hover:opacity-90"
            onClick={() => onConnect(integration.slug)}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
};

export default IntegrationCard;
