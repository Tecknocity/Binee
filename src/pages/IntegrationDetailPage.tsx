import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageLayout } from '../components/Layout';
import { IntegrationDetail, DataMappingInterface } from '../components/integrations';
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

const IntegrationDetailPage: React.FC = () => {
  const { slug, view } = useParams<{ slug: string; view?: string }>();
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);

  const integration = integrations.find((i) => i.slug === slug) || null;

  const handleDisconnect = (targetSlug: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.slug === targetSlug
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

  const handleSync = (targetSlug: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.slug === targetSlug
          ? { ...i, lastSyncedAt: new Date().toISOString() }
          : i
      )
    );
  };

  const pageTitle = integration ? integration.name : 'Integration Details';
  const pageSubtitle = integration
    ? view === 'mapping'
      ? 'Data Mapping Configuration'
      : 'Manage connection and sync settings'
    : 'Integration not found';

  return (
    <PageLayout title={pageTitle} subtitle={pageSubtitle}>
      {view === 'mapping' && integration ? (
        <DataMappingInterface
          slug={integration.slug}
          integrationName={integration.name}
        />
      ) : (
        <IntegrationDetail
          integration={integration}
          onDisconnect={handleDisconnect}
          onSync={handleSync}
        />
      )}
    </PageLayout>
  );
};

export default IntegrationDetailPage;
