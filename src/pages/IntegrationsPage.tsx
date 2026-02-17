import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntegrationGrid, ConnectModal } from '../components/integrations';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, Circle, Puzzle, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Integration } from '@/data/mock/integrations';

const INTEGRATIONS: Integration[] = [
  {
    id: '1',
    name: 'HubSpot',
    slug: 'hubspot',
    category: 'CRM & Sales',
    description: 'CRM, deals, pipeline, and contacts',
    icon: 'Target',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T06:30:00Z',
    datapointsSynced: 1247,
    syncFrequency: '30min',
    connectedAccount: 'tecknocity.com',
  },
  {
    id: '2',
    name: 'Salesforce',
    slug: 'salesforce',
    category: 'CRM & Sales',
    description: 'Enterprise CRM platform',
    icon: 'Cloud',
    isConnected: false,
    isComingSoon: true,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },
  {
    id: '3',
    name: 'Stripe',
    slug: 'stripe',
    category: 'Finance & Payments',
    description: 'Subscriptions, payments, and revenue',
    icon: 'CreditCard',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T07:00:00Z',
    datapointsSynced: 892,
    syncFrequency: '1hour',
    connectedAccount: 'tecknocity',
  },
  {
    id: '4',
    name: 'QuickBooks',
    slug: 'quickbooks',
    category: 'Finance & Payments',
    description: 'Accounting, expenses, and invoices',
    icon: 'BookOpen',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T05:15:00Z',
    datapointsSynced: 634,
    syncFrequency: '6hours',
    connectedAccount: 'Tecknocity LLC',
  },
  {
    id: '5',
    name: 'ClickUp',
    slug: 'clickup',
    category: 'Project Management',
    description: 'Tasks, projects, and team workload',
    icon: 'CheckSquare',
    isConnected: true,
    isComingSoon: false,
    lastSyncedAt: '2026-02-17T07:15:00Z',
    datapointsSynced: 2150,
    syncFrequency: '15min',
    connectedAccount: 'Tecknocity Workspace',
  },
  {
    id: '6',
    name: 'Asana',
    slug: 'asana',
    category: 'Project Management',
    description: 'Project and task management',
    icon: 'Layout',
    isConnected: false,
    isComingSoon: true,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },
  {
    id: '7',
    name: 'Notion',
    slug: 'notion',
    category: 'Project Management',
    description: 'Documents, databases, and wikis',
    icon: 'FileText',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every hour',
    connectedAccount: null,
  },
  {
    id: '8',
    name: 'Gmail',
    slug: 'gmail',
    category: 'Communication',
    description: 'Email activity and response times',
    icon: 'Mail',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 30 minutes',
    connectedAccount: null,
  },
  {
    id: '9',
    name: 'Slack',
    slug: 'slack',
    category: 'Communication',
    description: 'Team communication and channels',
    icon: 'MessageSquare',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Real-time',
    connectedAccount: null,
  },
  {
    id: '10',
    name: 'Google Calendar',
    slug: 'google-calendar',
    category: 'Communication',
    description: 'Meetings, availability, and focus time',
    icon: 'Calendar',
    isConnected: false,
    isComingSoon: false,
    lastSyncedAt: null,
    datapointsSynced: null,
    syncFrequency: 'Every 15 minutes',
    connectedAccount: null,
  },
];

const IntegrationsPage: React.FC<{ embedded?: boolean }> = ({ embedded } = {}) => {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);

  const connectedCount = integrations.filter((i) => i.isConnected).length;
  const availableCount = integrations.filter((i) => !i.isConnected && !i.isComingSoon).length;

  const handleConnect = (slug: string) => {
    const integration = integrations.find((i) => i.slug === slug);
    if (integration && !integration.isComingSoon) {
      setSelectedIntegration(integration);
      setConnectModalOpen(true);
    }
  };

  const handleConfirmConnect = (slug: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.slug === slug
          ? {
              ...i,
              isConnected: true,
              lastSyncedAt: new Date().toISOString(),
              datapointsSynced: Math.floor(Math.random() * 500) + 100,
              connectedAccount: 'connected@tecknocity.com',
            }
          : i
      )
    );
  };

  const handleDisconnect = (slug: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.slug === slug
          ? {
              ...i,
              isConnected: false,
              lastSyncedAt: null,
              datapointsSynced: null,
              connectedAccount: null,
            }
          : i
      )
    );
  };

  const handleSync = (slug: string) => {
    setSyncingSlug(slug);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.slug === slug
            ? { ...i, lastSyncedAt: new Date().toISOString() }
            : i
        )
      );
      setSyncingSlug(null);
    }, 2000);
  };

  const handleManage = (slug: string) => {
    navigate(`/integrations/${slug}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your tools to power your Business Command Center</p>
      </div>
      {/* Stats Bar */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center">
              <CheckCircle size={18} className="text-success" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{connectedCount}</div>
              <div className="text-xs text-muted-foreground">Connected</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Circle size={18} className="text-muted-foreground" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{availableCount}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Zap size={18} className="text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">
                {integrations.filter((i) => i.isComingSoon).length}
              </div>
              <div className="text-xs text-muted-foreground">Coming Soon</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Grid */}
      <IntegrationGrid
        integrations={integrations}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
        onManage={handleManage}
        syncingSlug={syncingSlug}
      />

      {/* Connect Modal */}
      <ConnectModal
        integration={selectedIntegration}
        isOpen={connectModalOpen}
        onClose={() => {
          setConnectModalOpen(false);
          setSelectedIntegration(null);
        }}
        onConfirm={handleConfirmConnect}
      />
    </div>
  );
};

export default IntegrationsPage;
