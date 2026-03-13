'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Loader2, Plug, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type IntegrationStatus = 'connected' | 'not_connected' | 'coming_soon';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  logo: React.ReactNode;
  color: string;
}

// ── SVG Logos ──────────────────────────────────────────────

function ClickUpLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <linearGradient id="cu1" x1="4" y1="18" x2="20" y2="6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8930FD" />
        <stop offset="1" stopColor="#49CCF9" />
      </linearGradient>
      <path d="M4.5 17.5L8.5 14L12 17L15.5 14L19.5 17.5" stroke="url(#cu1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11.5L12 5L19.5 11.5" stroke="url(#cu1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MondayLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="6" cy="15" r="2.5" fill="#FF3D57" />
      <circle cx="12" cy="12" r="2.5" fill="#FFCB00" />
      <circle cx="18" cy="9" r="2.5" fill="#00CA72" />
    </svg>
  );
}

function AsanaLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="7" r="3.5" fill="#F06A6A" />
      <circle cx="6.5" cy="15.5" r="3.5" fill="#F06A6A" />
      <circle cx="17.5" cy="15.5" r="3.5" fill="#F06A6A" />
    </svg>
  );
}

function JiraLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M12 2L20 12L12 22L4 12L12 2Z" fill="#2684FF" opacity="0.9" />
      <path d="M12 7L16 12L12 17L8 12L12 7Z" fill="white" opacity="0.4" />
    </svg>
  );
}

function LinearLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M3 19.5L4.5 21C5.33 20.17 19.5 6 19.5 6L18 4.5L3 19.5Z" fill="#5E6AD2" />
      <path d="M12 3C7.03 3 3 7.03 3 12L12 3Z" fill="#5E6AD2" />
      <path d="M21 12C21 16.97 16.97 21 12 21L21 12Z" fill="#5E6AD2" />
    </svg>
  );
}

function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="3" fill="#FF7A59" />
      <circle cx="12" cy="5" r="1.5" fill="#FF7A59" />
      <circle cx="12" cy="19" r="1.5" fill="#FF7A59" />
      <circle cx="5" cy="12" r="1.5" fill="#FF7A59" />
      <circle cx="19" cy="12" r="1.5" fill="#FF7A59" />
      <path d="M12 6.5V9M12 15V17.5M6.5 12H9M15 12H17.5" stroke="#FF7A59" strokeWidth="1.2" />
    </svg>
  );
}

function SalesforceLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M5 14C5 11.24 7.24 9 10 9C10.7 7.83 12 7 13.5 7C15.43 7 17 8.57 17 10.5V10.5C18.66 10.5 20 11.84 20 13.5C20 15.16 18.66 16.5 17 16.5H7C5.9 16.5 5 15.6 5 14.5V14Z" fill="#00A1E0" />
    </svg>
  );
}

function TrelloLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#0079BF" />
      <rect x="5.5" y="5.5" width="5" height="10" rx="1" fill="white" />
      <rect x="13.5" y="5.5" width="5" height="7" rx="1" fill="white" />
    </svg>
  );
}

function SlackLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M6 14.5C6 15.33 5.33 16 4.5 16S3 15.33 3 14.5 3.67 13 4.5 13H6V14.5Z" fill="#E01E5A" />
      <path d="M6.75 14.5C6.75 13.67 7.42 13 8.25 13S9.75 13.67 9.75 14.5V19.5C9.75 20.33 9.08 21 8.25 21S6.75 20.33 6.75 19.5V14.5Z" fill="#E01E5A" />
      <path d="M8.25 6C7.42 6 6.75 5.33 6.75 4.5S7.42 3 8.25 3 9.75 3.67 9.75 4.5V6H8.25Z" fill="#36C5F0" />
      <path d="M8.25 6.75C9.08 6.75 9.75 7.42 9.75 8.25S9.08 9.75 8.25 9.75H3.25C2.42 9.75 1.75 9.08 1.75 8.25S2.42 6.75 3.25 6.75H8.25Z" fill="#36C5F0" />
      <path d="M16.75 8.25C16.75 7.42 17.42 6.75 18.25 6.75S19.75 7.42 19.75 8.25 19.08 9.75 18.25 9.75H16.75V8.25Z" fill="#2EB67D" />
      <path d="M16 8.25C16 9.08 15.33 9.75 14.5 9.75S13 9.08 13 8.25V3.25C13 2.42 13.67 1.75 14.5 1.75S16 2.42 16 3.25V8.25Z" fill="#2EB67D" />
      <path d="M14.5 16.75C15.33 16.75 16 17.42 16 18.25S15.33 19.75 14.5 19.75 13 19.08 13 18.25V16.75H14.5Z" fill="#ECB22E" />
      <path d="M14.5 16C13.67 16 13 15.33 13 14.5S13.67 13 14.5 13H19.5C20.33 13 21 13.67 21 14.5S20.33 16 19.5 16H14.5Z" fill="#ECB22E" />
    </svg>
  );
}

function GmailLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="#F2F2F2" />
      <path d="M3 7L12 13L21 7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7V17" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21 7V17" stroke="#34A853" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 17L10 12" stroke="#FBBC05" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21 17L14 12" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#4285F4" />
      <rect x="3" y="3" width="18" height="6" rx="2" fill="#1967D2" />
      <rect x="5" y="11" width="4" height="3" rx="0.5" fill="white" />
      <rect x="10" y="11" width="4" height="3" rx="0.5" fill="white" />
      <rect x="15" y="11" width="4" height="3" rx="0.5" fill="white" />
      <rect x="5" y="15.5" width="4" height="3" rx="0.5" fill="white" />
      <rect x="10" y="15.5" width="4" height="3" rx="0.5" fill="white" />
    </svg>
  );
}

function GoogleDriveLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M8 21L3 13L8 5H16L21 13L16 21H8Z" fill="#FBBC05" />
      <path d="M8 5L16 5L21 13H13L8 5Z" fill="#34A853" />
      <path d="M3 13L8 5L13 13H3Z" fill="#4285F4" />
      <path d="M8 21L13 13H21L16 21H8Z" fill="#EA4335" />
    </svg>
  );
}

function NotionLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="4" y="3" width="16" height="18" rx="2" fill="white" stroke="#333" strokeWidth="1.2" />
      <path d="M8 8H16M8 12H14M8 16H12" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#635BFF" />
      <path d="M11.5 10C11.5 9.17 12.17 8.5 13 8.5C13.83 8.5 14.5 9.17 14.5 10C14.5 11 12 11.5 12 13H14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 15.5C9.5 14 10.5 13 12 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QuickBooksLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" fill="#2CA01C" />
      <path d="M8 9V15M8 12H11C12.1 12 13 11.1 13 10S12.1 9 11 9H8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 9V15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FirefliesLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="4" fill="#B845F2" />
      <circle cx="12" cy="4" r="1.5" fill="#B845F2" opacity="0.6" />
      <circle cx="12" cy="20" r="1.5" fill="#B845F2" opacity="0.6" />
      <circle cx="4" cy="12" r="1.5" fill="#B845F2" opacity="0.6" />
      <circle cx="20" cy="12" r="1.5" fill="#B845F2" opacity="0.6" />
      <circle cx="6.34" cy="6.34" r="1.2" fill="#B845F2" opacity="0.4" />
      <circle cx="17.66" cy="17.66" r="1.2" fill="#B845F2" opacity="0.4" />
      <circle cx="17.66" cy="6.34" r="1.2" fill="#B845F2" opacity="0.4" />
      <circle cx="6.34" cy="17.66" r="1.2" fill="#B845F2" opacity="0.4" />
    </svg>
  );
}

function OtterLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" fill="#0F62FE" />
      <path d="M8 10C8 10 9.5 8 12 8C14.5 8 16 10 16 10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9.5" cy="12" r="1" fill="white" />
      <circle cx="14.5" cy="12" r="1" fill="white" />
      <path d="M10 15C10 15 11 16 12 16C13 16 14 15 14 15" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendlyLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" fill="#006BFF" />
      <path d="M12 7V12L15 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Categories & Integration Data ──────────────────────────

const categories = [
  'Project Management',
  'CRM',
  'Communication & Docs',
  'Finance & Meetings',
] as const;

function useIntegrations(): Integration[] {
  const { workspace } = useAuth();
  const isClickUpConnected = !!workspace?.clickup_team_id;

  return [
    // Project Management
    {
      id: 'clickup',
      name: 'ClickUp',
      description: 'Connect your ClickUp workspace for AI-powered project management, health monitoring, and custom dashboards.',
      category: 'Project Management',
      status: isClickUpConnected ? 'connected' : 'not_connected',
      logo: <ClickUpLogo />,
      color: '#7B68EE',
    },
    {
      id: 'monday',
      name: 'Monday.com',
      description: 'Sync your Monday boards to manage workflows, track progress, and automate updates.',
      category: 'Project Management',
      status: 'coming_soon',
      logo: <MondayLogo />,
      color: '#FF3D57',
    },
    {
      id: 'asana',
      name: 'Asana',
      description: 'Connect Asana to organize tasks, track milestones, and keep your team aligned.',
      category: 'Project Management',
      status: 'coming_soon',
      logo: <AsanaLogo />,
      color: '#F06A6A',
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Integrate Jira for sprint planning, issue tracking, and agile workflow management.',
      category: 'Project Management',
      status: 'coming_soon',
      logo: <JiraLogo />,
      color: '#2684FF',
    },
    {
      id: 'linear',
      name: 'Linear',
      description: 'Sync Linear issues for streamlined engineering workflows and sprint tracking.',
      category: 'Project Management',
      status: 'coming_soon',
      logo: <LinearLogo />,
      color: '#5E6AD2',
    },
    // CRM
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Connect HubSpot to manage contacts, track deals, and automate your sales pipeline.',
      category: 'CRM',
      status: 'coming_soon',
      logo: <HubSpotLogo />,
      color: '#FF7A59',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Integrate Salesforce for CRM insights, lead tracking, and sales automation.',
      category: 'CRM',
      status: 'coming_soon',
      logo: <SalesforceLogo />,
      color: '#00A1E0',
    },
    {
      id: 'trello',
      name: 'Trello',
      description: 'Sync Trello boards to manage visual workflows, tasks, and team collaboration.',
      category: 'CRM',
      status: 'coming_soon',
      logo: <TrelloLogo />,
      color: '#0079BF',
    },
    // Communication & Docs
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get Binee updates and notifications directly in your Slack channels.',
      category: 'Communication & Docs',
      status: 'coming_soon',
      logo: <SlackLogo />,
      color: '#4A154B',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Connect Gmail to send notifications, daily digests, and task summaries to your inbox.',
      category: 'Communication & Docs',
      status: 'coming_soon',
      logo: <GmailLogo />,
      color: '#EA4335',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync deadlines and meetings with Google Calendar for automatic scheduling.',
      category: 'Communication & Docs',
      status: 'coming_soon',
      logo: <GoogleCalendarLogo />,
      color: '#4285F4',
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Access and reference Google Drive files directly within your Binee workspace.',
      category: 'Communication & Docs',
      status: 'coming_soon',
      logo: <GoogleDriveLogo />,
      color: '#0F9D58',
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Connect Notion to sync documents, wikis, and knowledge bases with your workspace.',
      category: 'Communication & Docs',
      status: 'coming_soon',
      logo: <NotionLogo />,
      color: '#000000',
    },
    // Finance & Meetings
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Integrate Stripe to track revenue, subscriptions, and payment analytics.',
      category: 'Finance & Meetings',
      status: 'coming_soon',
      logo: <StripeLogo />,
      color: '#635BFF',
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Connect QuickBooks for expense tracking, invoicing, and financial reporting.',
      category: 'Finance & Meetings',
      status: 'coming_soon',
      logo: <QuickBooksLogo />,
      color: '#2CA01C',
    },
    {
      id: 'fireflies',
      name: 'Fireflies.ai',
      description: 'Automatically transcribe and summarize your meetings with Fireflies integration.',
      category: 'Finance & Meetings',
      status: 'coming_soon',
      logo: <FirefliesLogo />,
      color: '#B845F2',
    },
    {
      id: 'otter',
      name: 'Otter.ai',
      description: 'Connect Otter.ai for AI-powered meeting notes and real-time transcription.',
      category: 'Finance & Meetings',
      status: 'coming_soon',
      logo: <OtterLogo />,
      color: '#0F62FE',
    },
    {
      id: 'calendly',
      name: 'Calendly',
      description: 'Sync Calendly events to automatically track meetings and scheduling.',
      category: 'Finance & Meetings',
      status: 'coming_soon',
      logo: <CalendlyLogo />,
      color: '#006BFF',
    },
  ];
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
        <CheckCircle className="w-3 h-3" />
        Connected
      </span>
    );
  }
  if (status === 'not_connected') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-text-muted bg-surface px-2.5 py-1 rounded-full border border-border">
        <AlertCircle className="w-3 h-3" />
        Not connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-text-muted bg-surface px-2.5 py-1 rounded-full border border-border/50">
      <Clock className="w-3 h-3" />
      Coming soon
    </span>
  );
}

export default function IntegrationsSettingsPage() {
  const integrations = useIntegrations();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = async (id: string) => {
    setSyncing(id);
    await new Promise((r) => setTimeout(r, 2000));
    setSyncing(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-1">Integrations</h2>
        <p className="text-sm text-text-secondary">
          Connect your tools to supercharge your workspace with AI-powered insights.
        </p>
      </div>

      {categories.map((category) => {
        const items = integrations.filter((i) => i.category === category);
        if (items.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              {category}
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {items.map((integration) => (
                <div
                  key={integration.id}
                  className={cn(
                    'flex items-start gap-4 p-4 border rounded-xl transition-colors',
                    integration.status === 'connected'
                      ? 'bg-surface border-accent/20'
                      : integration.status === 'not_connected'
                        ? 'bg-surface border-border hover:border-accent/30'
                        : 'bg-surface/50 border-border/50'
                  )}
                >
                  {/* Logo */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${integration.color}15`, border: `1px solid ${integration.color}25` }}
                  >
                    {integration.logo}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-text-primary">{integration.name}</h4>
                      <StatusBadge status={integration.status} />
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {integration.description}
                    </p>

                    {/* Actions for connected/connectable integrations */}
                    {integration.status === 'connected' && (
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => handleSync(integration.id)}
                          disabled={syncing === integration.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-base border border-border rounded-lg text-xs text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          {syncing === integration.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Sync now
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 border border-error/30 rounded-lg text-xs text-error hover:bg-error/10 transition-colors">
                          Disconnect
                        </button>
                      </div>
                    )}
                    {integration.status === 'not_connected' && (
                      <div className="mt-3">
                        <button
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                          style={{ backgroundColor: integration.color }}
                        >
                          <Plug className="w-3.5 h-3.5" />
                          Connect
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Request integration */}
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">
          Want a specific integration? Let us know and we&apos;ll prioritize it.
        </p>
      </div>
    </div>
  );
}
