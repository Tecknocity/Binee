import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import { theme } from '../styles/theme';
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

  const cardStyle: React.CSSProperties = {
    background: theme.colors.cardBgSolid,
    borderRadius: theme.borderRadius['2xl'],
    border: theme.colors.cardBorder,
    padding: theme.spacing['2xl'],
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    transition: `all ${theme.transitions.normal}`,
    position: 'relative',
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    background: theme.colors.gradient,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
  };

  // Empty state when no integrations are connected
  if (connectedCount === 0) {
    return (
      <PageLayout title="Integrations" subtitle="Connect your favorite tools and services">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing['3xl'],
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.primaryLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing['2xl'],
            }}
          >
            <Puzzle size={48} color={theme.colors.primary} />
          </div>
          <h2
            style={{
              fontSize: theme.fontSize['3xl'],
              fontWeight: theme.fontWeight.bold,
              marginBottom: theme.spacing.lg,
            }}
          >
            No Integrations Connected
          </h2>
          <p
            style={{
              fontSize: theme.fontSize.lg,
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing['2xl'],
              maxWidth: '500px',
            }}
          >
            Connect your first integration to start syncing data and unlock the full power of your
            Business Command Center.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.md,
              color: theme.colors.accent,
              fontSize: theme.fontSize.base,
            }}
          >
            <Zap size={18} />
            <span>Choose from 8 popular integrations below</span>
          </div>
        </div>

        {/* Integration Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: theme.spacing.xl,
            marginTop: theme.spacing['2xl'],
          }}
        >
          {integrations.map((integration) => (
            <div key={integration.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.lg }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: theme.borderRadius.xl,
                    background: theme.colors.dark,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                  }}
                >
                  {integration.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                    <h3
                      style={{
                        fontSize: theme.fontSize.lg,
                        fontWeight: theme.fontWeight.semibold,
                      }}
                    >
                      {integration.name}
                    </h3>
                  </div>
                  <p
                    style={{
                      fontSize: theme.fontSize.sm,
                      color: theme.colors.textSecondary,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    {integration.description}
                  </p>
                </div>
              </div>

              <button style={buttonStyle} onClick={() => handleConnect(integration.id)}>
                Connect
              </button>
            </div>
          ))}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Integrations" subtitle="Connect your favorite tools and services">
      {/* Stats Bar */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.xl,
          marginBottom: theme.spacing['2xl'],
        }}
      >
        <div
          style={{
            background: theme.colors.cardBgSolid,
            borderRadius: theme.borderRadius.xl,
            border: theme.colors.cardBorder,
            padding: theme.spacing.xl,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.lg,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: theme.borderRadius.lg,
              background: theme.colors.successLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle size={20} color={theme.colors.success} />
          </div>
          <div>
            <div
              style={{
                fontSize: theme.fontSize['2xl'],
                fontWeight: theme.fontWeight.bold,
              }}
            >
              {connectedCount}
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
              Connected
            </div>
          </div>
        </div>

        <div
          style={{
            background: theme.colors.cardBgSolid,
            borderRadius: theme.borderRadius.xl,
            border: theme.colors.cardBorder,
            padding: theme.spacing.xl,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.lg,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: theme.borderRadius.lg,
              background: theme.colors.mutedLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Circle size={20} color={theme.colors.muted} />
          </div>
          <div>
            <div
              style={{
                fontSize: theme.fontSize['2xl'],
                fontWeight: theme.fontWeight.bold,
              }}
            >
              {integrations.length - connectedCount}
            </div>
            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
              Available
            </div>
          </div>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: theme.spacing.xl,
        }}
      >
        {integrations.map((integration) => (
          <div
            key={integration.id}
            style={{
              ...cardStyle,
              borderColor: integration.connected ? theme.colors.successBorder : undefined,
            }}
          >
            {/* Integration Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.lg }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: theme.borderRadius.xl,
                  background: theme.colors.dark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                }}
              >
                {integration.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <h3
                    style={{
                      fontSize: theme.fontSize.xl,
                      fontWeight: theme.fontWeight.semibold,
                    }}
                  >
                    {integration.name}
                  </h3>
                  <span
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                      background: integration.connected
                        ? theme.colors.successLight
                        : theme.colors.mutedLight,
                      border: `1px solid ${
                        integration.connected ? theme.colors.successBorder : theme.colors.mutedBorder
                      }`,
                      borderRadius: theme.borderRadius.md,
                      color: integration.connected ? theme.colors.success : theme.colors.muted,
                      fontSize: theme.fontSize.xs,
                      fontWeight: theme.fontWeight.semibold,
                      textTransform: 'uppercase',
                    }}
                  >
                    {integration.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: theme.fontSize.base,
                    color: theme.colors.textSecondary,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  {integration.description}
                </p>
              </div>
            </div>

            {/* Last Synced */}
            {integration.connected && integration.lastSynced && (
              <div
                style={{
                  fontSize: theme.fontSize.sm,
                  color: theme.colors.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <RefreshCw size={14} />
                Last synced: {integration.lastSynced}
              </div>
            )}

            {/* Action Button */}
            <div style={{ marginTop: 'auto' }}>
              {integration.connected ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      style={{
                        width: '100%',
                        padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                        background: theme.colors.dark,
                        border: `1px solid ${theme.colors.mutedBorder}`,
                        borderRadius: theme.borderRadius.lg,
                        color: theme.colors.text,
                        fontSize: theme.fontSize.base,
                        fontWeight: theme.fontWeight.medium,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      Manage
                      <ChevronDown size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700" align="end">
                    <DropdownMenuItem
                      className="text-white hover:bg-slate-700 cursor-pointer"
                      onClick={() => handleSync(integration.id)}
                      disabled={syncing === integration.id}
                    >
                      <RefreshCw
                        size={16}
                        className={`mr-2 ${syncing === integration.id ? 'animate-spin' : ''}`}
                      />
                      {syncing === integration.id ? 'Syncing...' : 'Sync Now'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-white hover:bg-slate-700 cursor-pointer"
                      onClick={() => handleViewSettings(integration.id)}
                    >
                      <Settings size={16} className="mr-2" />
                      View Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400 hover:bg-slate-700 hover:text-red-300 cursor-pointer"
                      onClick={() => handleDisconnect(integration.id)}
                    >
                      <Unlink size={16} className="mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  style={buttonStyle}
                  onClick={() => handleConnect(integration.id)}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
};

export default Integrations;
