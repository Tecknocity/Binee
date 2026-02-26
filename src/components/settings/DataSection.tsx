import React from 'react';
import { Database, Plug, AlertCircle, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IntegrationsPage from '@/pages/IntegrationsPage';
import DataMappingPage from '@/pages/DataMappingPage';
import DataQualityPage from '@/pages/DataQualityPage';
import RulesPage from '@/pages/RulesPage';

const DataSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Database size={20} />
          Data Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage integrations, data mapping, quality monitoring, and business rules
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug size={14} />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="data-mapping" className="flex items-center gap-2">
              <Database size={14} />
              Data Mapping
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <AlertCircle size={14} />
              Issues
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Shield size={14} />
              Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="mt-6">
            <IntegrationsPage />
          </TabsContent>

          <TabsContent value="data-mapping" className="mt-6">
            <DataMappingPage />
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <DataQualityPage />
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <RulesPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DataSection;
