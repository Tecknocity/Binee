'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Loader2, Plug, ExternalLink, AlertTriangle, X } from 'lucide-react';
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
      <defs>
        <linearGradient id="cu-grad" x1="4" y1="18" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8930FD" />
          <stop offset="1" stopColor="#49CCF9" />
        </linearGradient>
      </defs>
      <path d="M4 17L12 11L20 17" stroke="url(#cu-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13L12 7L17 13" stroke="url(#cu-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MondayLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M4.5 17C3.67 17 3 16.33 3 15.5V10C3 9.17 3.67 8.5 4.5 8.5S6 9.17 6 10V15.5C6 16.33 5.33 17 4.5 17Z" fill="#FF3D57" />
      <circle cx="4.5" cy="18.5" r="1.5" fill="#FF3D57" />
      <path d="M10.5 17C9.67 17 9 16.33 9 15.5V8.5C9 7.67 9.67 7 10.5 7S12 7.67 12 8.5V15.5C12 16.33 11.33 17 10.5 17Z" fill="#FFCB00" />
      <circle cx="10.5" cy="18.5" r="1.5" fill="#FFCB00" />
      <path d="M16.5 17C15.67 17 15 16.33 15 15.5V11.5C15 10.67 15.67 10 16.5 10S18 10.67 18 11.5V15.5C18 16.33 17.33 17 16.5 17Z" fill="#00CA72" />
      <circle cx="16.5" cy="18.5" r="1.5" fill="#00CA72" />
    </svg>
  );
}

function AsanaLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="6.5" r="3.8" fill="#F06A6A" />
      <circle cx="6" cy="15.5" r="3.8" fill="#F06A6A" />
      <circle cx="18" cy="15.5" r="3.8" fill="#F06A6A" />
    </svg>
  );
}

function JiraLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <defs>
        <linearGradient id="jira-grad1" x1="12" y1="2" x2="8" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
        <linearGradient id="jira-grad2" x1="12" y1="22" x2="16" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path d="M21.4 11.3L13.1 2.6C12.5 2 11.5 2 10.9 2.6L2.6 11.3C2 11.9 2 12.9 2.6 13.5L10.9 22.2C11.5 22.8 12.5 22.8 13.1 22.2L21.4 13.5C22 12.9 22 11.9 21.4 11.3ZM12 15.1C10.3 15.1 8.9 13.7 8.9 12S10.3 8.9 12 8.9S15.1 10.3 15.1 12S13.7 15.1 12 15.1Z" fill="#2684FF" />
    </svg>
  );
}

function LinearLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M3.51 12.96L11.04 20.49C6.76 20.05 3.45 16.56 3.51 12.96Z" fill="#5E6AD2" />
      <path d="M3.95 10.37L13.63 20.05C14.65 19.7 15.58 19.15 16.39 18.45L4.84 6.9C4.32 7.9 3.99 9.01 3.95 10.37Z" fill="#5E6AD2" />
      <path d="M5.79 5.79C8.66 2.92 13.27 2.54 16.56 4.63L12 2C7.58 2 4 5.58 4 10L5.79 5.79Z" fill="#5E6AD2" />
      <path d="M12 2C16.42 2 20 5.58 20 10V12C20 16.42 16.42 20 12 20L3.51 11.51C4 6.28 7.58 2 12 2Z" fill="#5E6AD2" />
    </svg>
  );
}

function HubSpotLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M15.5 7.5V5.5C16.33 5.22 16.93 4.43 16.93 3.5C16.93 2.4 16.03 1.5 14.93 1.5C13.83 1.5 12.93 2.4 12.93 3.5C12.93 4.43 13.53 5.22 14.36 5.5V7.5C13.36 7.72 12.45 8.2 11.72 8.87L5.93 4.63C5.98 4.45 6.01 4.27 6.01 4.07C6.01 2.93 5.08 2 3.94 2C2.8 2 1.87 2.93 1.87 4.07C1.87 5.21 2.8 6.14 3.94 6.14C4.34 6.14 4.71 6.03 5.03 5.83L10.72 10.01C10.24 10.82 9.96 11.76 9.96 12.77C9.96 13.82 10.26 14.8 10.77 15.63L9.14 17.26C8.97 17.21 8.78 17.17 8.59 17.17C7.49 17.17 6.59 18.07 6.59 19.17C6.59 20.27 7.49 21.17 8.59 21.17C9.69 21.17 10.59 20.27 10.59 19.17C10.59 18.93 10.54 18.7 10.46 18.49L12.13 16.83C13 17.42 14.04 17.77 15.17 17.77C18.09 17.77 20.46 15.4 20.46 12.48C20.46 9.79 18.46 7.55 15.84 7.22L15.5 7.5ZM15.17 15.57C13.49 15.57 12.13 14.21 12.13 12.53C12.13 10.85 13.49 9.49 15.17 9.49C16.85 9.49 18.21 10.85 18.21 12.53C18.21 14.21 16.85 15.57 15.17 15.57Z" fill="#FF7A59" />
    </svg>
  );
}

function SalesforceLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M10 6.5C10.8 5.6 11.9 5 13.2 5C14.9 5 16.4 5.9 17.1 7.3C17.6 7.1 18.2 7 18.8 7C21.1 7 23 8.9 23 11.2C23 13.5 21.1 15.4 18.8 15.4H5.8C3.7 15.4 2 13.7 2 11.6C2 9.9 3.1 8.4 4.7 7.9C4.6 7.6 4.5 7.2 4.5 6.8C4.5 5.3 5.7 4 7.3 4C8.3 4 9.2 4.5 9.8 5.3" fill="#00A1E0" />
      <path d="M10 6.5C10.5 5.8 11.2 5.3 12.1 5.1C12.5 5 12.8 5 13.2 5C14.9 5 16.4 5.9 17.1 7.3C17.6 7.1 18.2 7 18.8 7C21.1 7 23 8.9 23 11.2C23 13.5 21.1 15.4 18.8 15.4H5.8C3.7 15.4 2 13.7 2 11.6C2 9.9 3.1 8.4 4.7 7.9C4.6 7.6 4.5 7.2 4.5 6.8C4.5 5.3 5.7 4 7.3 4C8.4 4 9.4 4.6 10 6.5Z" fill="#00A1E0" />
    </svg>
  );
}

function TrelloLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0079BF" />
      <rect x="4.5" y="4.5" width="6" height="12" rx="1.2" fill="white" />
      <rect x="13.5" y="4.5" width="6" height="8" rx="1.2" fill="white" />
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
      <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="white" />
      <path d="M2 6L12 13L22 6" stroke="#EA4335" strokeWidth="0" fill="none" />
      <path d="M22 6L12 13L2 6V4H4L12 10.5L20 4H22V6Z" fill="#EA4335" />
      <path d="M2 6V18H4V8L12 14.5L20 8V18H22V6L12 13L2 6Z" fill="none" />
      <path d="M2 6V18C2 19.1 2.9 20 4 20H6V8.5L12 13.5L18 8.5V20H20C21.1 20 22 19.1 22 18V6L12 13L2 6Z" fill="none" />
      <rect x="2" y="4" width="4" height="16" rx="0" fill="#4285F4" />
      <rect x="18" y="4" width="4" height="16" rx="0" fill="#34A853" />
      <path d="M2 4H4L12 10.5L20 4H22V6L12 13L2 6V4Z" fill="#EA4335" />
      <path d="M2 18V20H6V10L2 6.5V18Z" fill="#C5221F" opacity="0.3" />
      <path d="M22 18V20H18V10L22 6.5V18Z" fill="#1E8E3E" opacity="0.3" />
      <path d="M2 4L12 12L22 4" stroke="#D93025" strokeWidth="0" />
    </svg>
  );
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M18 3H6C4.34 3 3 4.34 3 6V18C3 19.66 4.34 21 6 21H18C19.66 21 21 19.66 21 18V6C21 4.34 19.66 3 18 3Z" fill="white" />
      <path d="M18 3H6C4.34 3 3 4.34 3 6V8H21V6C21 4.34 19.66 3 18 3Z" fill="#4285F4" />
      <rect x="5.5" y="10" width="3.5" height="3" rx="0.5" fill="#4285F4" />
      <rect x="10.25" y="10" width="3.5" height="3" rx="0.5" fill="#4285F4" />
      <rect x="15" y="10" width="3.5" height="3" rx="0.5" fill="#4285F4" />
      <rect x="5.5" y="14.5" width="3.5" height="3" rx="0.5" fill="#4285F4" />
      <rect x="10.25" y="14.5" width="3.5" height="3" rx="0.5" fill="#4285F4" />
      <rect x="15" y="14.5" width="3.5" height="3" rx="0.5" fill="#4285F4" opacity="0.4" />
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#DADCE0" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

function GoogleDriveLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M8.6 3H15.4L22 14.5H15.2L8.6 3Z" fill="#0F9D58" />
      <path d="M2 14.5L5.4 21H18.6L15.2 14.5H2Z" fill="#4285F4" />
      <path d="M8.6 3L2 14.5H8.8L15.4 3H8.6Z" fill="#FBBC04" />
    </svg>
  );
}

function NotionLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path d="M4.5 4.5C4.5 3.67 5.17 3 6 3H16.5L19.5 6V19.5C19.5 20.33 18.83 21 18 21H6C5.17 21 4.5 20.33 4.5 19.5V4.5Z" fill="white" stroke="#333" strokeWidth="1" />
      <path d="M7.5 7H12.5L7.5 13V7Z" fill="#333" />
      <path d="M7.5 7V13L12.5 7H7.5Z" fill="#333" />
      <path d="M10 10.5L16.5 10.5V17L10 17" stroke="#333" strokeWidth="1" strokeLinecap="round" />
      <path d="M10 10.5V17" stroke="#333" strokeWidth="1" strokeLinecap="round" />
      <path d="M16.5 10.5V17" stroke="#333" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#635BFF" />
      <path d="M12.5 8.5C11 8.5 10.2 9.1 10.2 10C10.2 11.8 14 11.2 14 13.6C14 15.3 12.6 16 11 16C10 16 8.8 15.6 8.2 15.2L8.6 13.8C9.3 14.2 10.2 14.6 11 14.6C11.8 14.6 12.4 14.3 12.4 13.5C12.4 11.6 8.6 12.3 8.6 10C8.6 8.4 9.9 7.2 12.2 7.2C13.1 7.2 14 7.4 14.6 7.7L14.2 9C13.6 8.7 12.9 8.5 12.5 8.5Z" fill="white" />
    </svg>
  );
}

function QuickBooksLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="10" fill="#2CA01C" />
      <path d="M7.5 8.5V15.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 8.5H10.5C12 8.5 13.2 9.5 13.2 11C13.2 12.5 12 13.5 10.5 13.5H7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 8.5V15.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 15.5H13.5C12 15.5 10.8 14.5 10.8 13C10.8 11.5 12 10.5 13.5 10.5H16.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FirefliesLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <defs>
        <linearGradient id="ff-grad" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B845F2" />
          <stop offset="1" stopColor="#7B2FD4" />
        </linearGradient>
      </defs>
      <path d="M12 2C12 2 8 6 8 10C8 12.2 9.8 14 12 14C14.2 14 16 12.2 16 10C16 6 12 2 12 2Z" fill="url(#ff-grad)" />
      <path d="M12 14V18" stroke="#B845F2" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="20" r="2" fill="#B845F2" />
      <path d="M9 16L6 18" stroke="#B845F2" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M15 16L18 18" stroke="#B845F2" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function OtterLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#0F62FE" />
      <path d="M7 11C7 8.24 9.24 6 12 6C14.76 6 17 8.24 17 11V14C17 15.66 15.66 17 14 17H10C8.34 17 7 15.66 7 14V11Z" fill="white" />
      <circle cx="10" cy="11.5" r="1.2" fill="#0F62FE" />
      <circle cx="14" cy="11.5" r="1.2" fill="#0F62FE" />
      <path d="M10.5 14C10.5 14 11.25 15 12 15C12.75 15 13.5 14 13.5 14" stroke="#0F62FE" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function CalendlyLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="12" cy="12" r="10" fill="#006BFF" />
      <path d="M12 6V12H17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" />
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
      description: 'Connect your ClickUp workspace for AI-powered project management, sync, and workspace intelligence.',
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

// ---------------------------------------------------------------------------
// ClickUp Connection Status
// ---------------------------------------------------------------------------

interface ClickUpStatus {
  connected: boolean;
  teamName: string | null;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'complete' | 'error';
  syncError: string | null;
  planTier: string | null;
  rateLimitRemaining: number | null;
  rateLimitTotal: number | null;
  webhookHealthy: boolean | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  unlimited: 'Unlimited',
  business: 'Business',
  business_plus: 'Business Plus',
  enterprise: 'Enterprise',
};

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function useClickUpStatus(workspaceId: string | undefined) {
  const [status, setStatus] = useState<ClickUpStatus>({
    connected: false,
    teamName: null,
    lastSyncedAt: null,
    syncStatus: 'idle',
    syncError: null,
    planTier: null,
    rateLimitRemaining: null,
    rateLimitTotal: null,
    webhookHealthy: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/clickup/status?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setStatus({
          connected: data.connected ?? false,
          teamName: data.team_name ?? null,
          lastSyncedAt: data.last_synced_at ?? null,
          syncStatus: data.sync_status ?? 'idle',
          syncError: data.sync_error ?? null,
          planTier: data.plan_tier ?? null,
          rateLimitRemaining: data.rate_limit_remaining ?? null,
          rateLimitTotal: data.rate_limit_total ?? null,
          webhookHealthy: data.webhook_healthy ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch ClickUp status:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}

function ClickUpStatusBar({ status }: { status: ClickUpStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      <StatusStat
        label="Team"
        value={status.teamName ?? 'Unknown'}
      />
      <StatDivider />
      <StatusStat
        label="Last synced"
        value={status.lastSyncedAt ? formatRelativeTime(status.lastSyncedAt) : 'Never'}
      />
      <StatDivider />
      <StatusStat
        label="Plan"
        value={status.planTier ? PLAN_LABELS[status.planTier] ?? status.planTier : 'Unknown'}
      />
      <StatDivider />
      <StatusStat
        label="Sync"
        value={
          status.syncStatus === 'syncing'
            ? 'Syncing...'
            : status.syncStatus === 'complete'
              ? 'Up to date'
              : status.syncStatus === 'error'
                ? 'Error'
                : 'Idle'
        }
        valueClassName={cn(
          status.syncStatus === 'complete' && 'text-success',
          status.syncStatus === 'syncing' && 'text-warning',
          status.syncStatus === 'error' && 'text-error',
        )}
      />
      <StatDivider />
      <StatusStat
        label="Webhook"
        value={
          status.webhookHealthy === true
            ? 'Healthy'
            : status.webhookHealthy === false
              ? 'Unhealthy'
              : 'Unknown'
        }
        valueClassName={cn(
          status.webhookHealthy === true && 'text-success',
          status.webhookHealthy === false && 'text-error',
        )}
      />
    </div>
  );
}

function StatusStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className={cn('font-medium text-text-primary', valueClassName)}>
        {value}
      </span>
    </span>
  );
}

function StatDivider() {
  return <span className="hidden sm:inline text-border">|</span>;
}

// ---------------------------------------------------------------------------
// Disconnect Modal
// ---------------------------------------------------------------------------

function DisconnectModal({
  onConfirm,
  onCancel,
  disconnecting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disconnecting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/10">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Disconnect ClickUp
            </h3>
            <p className="text-xs text-text-muted">
              This action cannot be undone automatically
            </p>
          </div>
        </div>
        <p className="mb-6 text-sm text-text-secondary">
          Are you sure you want to disconnect ClickUp? This will remove all
          cached data, webhooks, and sync history. You can reconnect at any
          time.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={disconnecting}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disconnecting}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'bg-error text-white hover:bg-red-600',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IntegrationsSettingsPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const { workspace_id, membership } = useWorkspace();
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const integrations = useIntegrations();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const { status: clickUpStatus, loading: clickUpLoading, refetch: refetchClickUp } = useClickUpStatus(workspace_id ?? undefined);

  const handleSync = async (id: string) => {
    if (!workspace?.id || id !== 'clickup') return;
    setSyncing(id);
    try {
      const res = await fetch('/api/clickup/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      if (res.ok) {
        const pollInterval = setInterval(async () => {
          await refetchClickUp();
        }, 3000);
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!workspace?.id || id !== 'clickup') return;
    setDisconnecting(id);
    try {
      const res = await fetch('/api/clickup/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      if (res.ok) {
        await refreshWorkspace();
        await refetchClickUp();
        setShowDisconnectModal(false);
      }
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnect = (id: string) => {
    if (id === 'clickup' && workspace?.id) {
      window.location.href = `/api/clickup/auth?workspace_id=${encodeURIComponent(workspace.id)}`;
    }
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
            <div className="space-y-2">
              {items.map((integration) => {
                const isConnected = integration.status === 'connected';
                const isNotConnected = integration.status === 'not_connected';
                const isComingSoon = integration.status === 'coming_soon';
                const isClickUp = integration.id === 'clickup';
                const isSyncing = syncing === integration.id || (isClickUp && clickUpStatus.syncStatus === 'syncing');

                return (
                  <div
                    key={integration.id}
                    className={cn(
                      'border rounded-xl transition-colors p-4',
                      isConnected
                        ? 'bg-surface border-accent/20'
                        : isNotConnected
                          ? 'bg-surface border-border hover:border-accent/30'
                          : 'bg-surface/50 border-border/50',
                    )}
                  >
                    {/* Row: logo + info + actions */}
                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${integration.color}15`,
                          border: `1px solid ${integration.color}25`,
                        }}
                      >
                        {integration.logo}
                      </div>

                      {/* Name + badge + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-text-primary">
                            {integration.name}
                          </h4>
                          <StatusBadge status={integration.status} />
                        </div>
                        {!isConnected && (
                          <p className="text-xs text-text-secondary mt-0.5 truncate">
                            {integration.description}
                          </p>
                        )}
                      </div>

                      {/* Actions — right side */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isConnected && isAdmin && (
                          <>
                            <button
                              onClick={() => handleSync(integration.id)}
                              disabled={isSyncing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-base border border-border rounded-lg text-xs text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                            >
                              {isSyncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              {isSyncing ? 'Syncing...' : 'Re-sync'}
                            </button>
                            <button
                              onClick={() => setShowDisconnectModal(true)}
                              disabled={disconnecting === integration.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-error/30 rounded-lg text-xs text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                            >
                              {disconnecting === integration.id && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              Disconnect
                            </button>
                          </>
                        )}
                        {isNotConnected && isAdmin && (
                          <button
                            onClick={() => handleConnect(integration.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                            style={{ backgroundColor: integration.color }}
                          >
                            <Plug className="w-3.5 h-3.5" />
                            Connect
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </button>
                        )}
                        {isNotConnected && !isAdmin && (
                          <span className="text-xs text-text-muted">
                            Admin required
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Connected status details — inline stats */}
                    {isConnected && isClickUp && !clickUpLoading && clickUpStatus.connected && (
                      <div className="ml-14">
                        <ClickUpStatusBar status={clickUpStatus} />

                        {/* Sync error */}
                        {clickUpStatus.syncError && (
                          <div className="mt-2 rounded-lg border border-error/20 bg-error/10 px-3 py-1.5 text-xs text-error">
                            {clickUpStatus.syncError}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Loading state for connected integration status */}
                    {isConnected && isClickUp && clickUpLoading && (
                      <div className="ml-14 mt-2 flex items-center gap-2">
                        <div className="h-3 w-48 animate-pulse rounded bg-navy-light" />
                        <div className="h-3 w-32 animate-pulse rounded bg-navy-light" />
                        <div className="h-3 w-24 animate-pulse rounded bg-navy-light" />
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Disconnect modal */}
      {showDisconnectModal && (
        <DisconnectModal
          onConfirm={() => handleDisconnect('clickup')}
          onCancel={() => setShowDisconnectModal(false)}
          disconnecting={disconnecting === 'clickup'}
        />
      )}
    </div>
  );
}
