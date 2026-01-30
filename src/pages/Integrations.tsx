import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import {
  CheckCircle,
  Circle,
  RefreshCw,
  Settings,
  Unlink,
  ChevronDown,
  Puzzle,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  lastSynced?: string;
  category: 'productivity' | 'communication' | 'finance' | 'crm';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Project management and task tracking',
    icon: '📋',
    connected: true,
    lastSynced: '2 hours ago',
    category: 'productivity',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing automation',
    icon: '🎯',
    connected: true,
    lastSynced: '30 minutes ago',
    category: 'crm',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email communication and tracking',
    icon: '✉️',
    connected: false,
    category: 'communication',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Event scheduling and reminders',
    icon: '📅',
    connected: true,
    lastSynced: '1 hour ago',
    category: 'productivity',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team messaging and notifications',
    icon: '💬',
    connected: false,
    category: 'communication',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and financial management',
    icon: '📊',
    connected: true,
    lastSynced: '4 hours ago',
    category: 'finance',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and billing',
    icon: '💳',
    connected: false,
    category: 'finance',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Documentation and knowledge base',
    icon: '📝',
    connected: false,
    category: 'productivity',
  },
];

const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [syncing, setSyncing] = useState<string | null>(null);

  const connectedCount = integrations.filter((i) => i.connected).length;

  const handleConnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, connected: true, lastSynced: 'Just now' }
          : integration
      )
    );
    alert(`Connected to ${integrations.find((i) => i.id === id)?.name}!`);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, connected: false, lastSynced: undefined }
          : integration
      )
    );
    alert(`Disconnected from ${integrations.find((i) => i.id === id)?.name}`);
  };

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === id ? { ...integration, lastSynced: 'Just now' } : integration
        )
      );
      setSyncing(null);
      alert(`${integrations.find((i) => i.id === id)?.name} synced successfully!`);
    }, 2000);
  };

  const handleViewSettings = (id: string) => {
    alert(`Opening settings for ${integrations.find((i) => i.id === id)?.name}...`);
  };

  // Empty state when no integrations are connected
  if (connectedCount === 0) {
    return (
      <PageLayout title="Integrations" subtitle="Connect your favorite tools and services">
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <div className="w-[120px] h-[120px] rounded-full bg-primary/15 flex items-center justify-center mb-8">
            <Puzzle size={48} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            No Integrations Connected
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-[500px]">
            Connect your first integration to start syncing data and unlock the full power of your
            Business Command Center.
          </p>
          <div className="flex items-center gap-3 text-accent text-sm">
            <Zap size={18} />
            <span>Choose from 8 popular integrations below</span>
          </div>
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 mt-8">
          {integrations.map((integration) => (
            <Card key={integration.id} className="glass border-border/50">
              <CardContent className="pt-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                    {integration.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                  </div>
                </div>
                <Button onClick={() => handleConnect(integration.id)}>
                  Connect
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Integrations" subtitle="Connect your favorite tools and services">
      {/* Stats Bar */}
      <div className="flex gap-6 mb-8">
        <Card className="glass border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
              <CheckCircle size={20} className="text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{connectedCount}</div>
              <div className="text-sm text-muted-foreground">Connected</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Circle size={20} className="text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {integrations.length - connectedCount}
              </div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
        {integrations.map((integration) => (
          <Card 
            key={integration.id} 
            className={`glass ${integration.connected ? 'border-success/30' : 'border-border/50'}`}
          >
            <CardContent className="pt-6 flex flex-col gap-4">
              {/* Integration Header */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-3xl">
                  {integration.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-foreground">{integration.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-semibold uppercase rounded ${
                        integration.connected
                          ? 'bg-success/15 text-success border border-success/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {integration.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                </div>
              </div>

              {/* Last Synced */}
              {integration.connected && integration.lastSynced && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <RefreshCw size={14} />
                  Last synced: {integration.lastSynced}
                </div>
              )}

              {/* Action Button */}
              <div className="mt-auto">
                {integration.connected ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full">
                        Manage
                        <ChevronDown size={16} className="ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleSync(integration.id)}
                        disabled={syncing === integration.id}
                      >
                        <RefreshCw
                          size={14}
                          className={syncing === integration.id ? 'animate-spin' : ''}
                        />
                        <span className="ml-2">
                          {syncing === integration.id ? 'Syncing...' : 'Sync Now'}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewSettings(integration.id)}>
                        <Settings size={14} />
                        <span className="ml-2">Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDisconnect(integration.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Unlink size={14} />
                        <span className="ml-2">Disconnect</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button onClick={() => handleConnect(integration.id)} className="w-full">
                    Connect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
};

export default Integrations;
