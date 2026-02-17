import React, { createContext, useContext, useState, ReactNode } from 'react';
import { mockIntegrations, Integration } from '@/data/mock/integrations';

interface IntegrationContextType {
  integrations: Integration[];
  connectIntegration: (slug: string) => void;
  disconnectIntegration: (slug: string) => void;
  syncIntegration: (slug: string) => void;
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);

  const connectIntegration = (slug: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.slug === slug
          ? {
              ...integration,
              isConnected: true,
              lastSyncedAt: new Date().toISOString(),
              datapointsSynced: Math.floor(Math.random() * 500) + 100,
            }
          : integration
      )
    );
  };

  const disconnectIntegration = (slug: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.slug === slug
          ? {
              ...integration,
              isConnected: false,
              lastSyncedAt: null,
              datapointsSynced: null,
              connectedAccount: null,
            }
          : integration
      )
    );
  };

  const syncIntegration = (slug: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.slug === slug
          ? {
              ...integration,
              lastSyncedAt: new Date().toISOString(),
            }
          : integration
      )
    );
  };

  return (
    <IntegrationContext.Provider
      value={{ integrations, connectIntegration, disconnectIntegration, syncIntegration }}
    >
      {children}
    </IntegrationContext.Provider>
  );
}

export function useIntegrations(): IntegrationContextType {
  const context = useContext(IntegrationContext);
  if (context === undefined) {
    throw new Error('useIntegrations must be used within an IntegrationProvider');
  }
  return context;
}
