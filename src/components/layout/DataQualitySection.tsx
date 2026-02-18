import React from 'react';
import { IssuesTab } from '../Dashboard/tabs/IssuesTab';
import { mockData } from '../../data/mockData';

export const DataQualitySection: React.FC = () => {
  return (
    <div>
      <IssuesTab integrationHealth={mockData.integrationHealth} />
    </div>
  );
};
