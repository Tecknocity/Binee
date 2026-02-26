import React from 'react';
import { Database, Plug, AlertCircle, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IntegrationsPage from '@/pages/IntegrationsPage';
import DataQualityPage from '@/pages/DataQualityPage';
import RulesPage from '@/pages/RulesPage';

const DataManagementPage: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Database size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage integrations, quality monitoring, and business rules
          </p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug size={14} />
            Integrations
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

        <TabsContent value="issues" className="mt-6">
          <DataQualityPage />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataManagementPage;
