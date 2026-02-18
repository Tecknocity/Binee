import React from 'react';
import { IssuesTab } from '../components/Dashboard/tabs/IssuesTab';
import { mockData } from '../data/mockData';
import { Wifi } from 'lucide-react';

const DataQualityPage: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-destructive/15 flex items-center justify-center">
          <Wifi size={24} className="text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integration Health & Issues</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor connection status, API errors, and sync issues across your integrations</p>
        </div>
      </div>
      <IssuesTab integrationHealth={mockData.integrationHealth} />
    </div>
  );
};

export default DataQualityPage;
