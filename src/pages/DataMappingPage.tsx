import React from 'react';
import { DataMappingSection } from '../components/layout/DataMappingSection';

const DataMappingPage: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
      <DataMappingSection />
    </div>
  );
};

export default DataMappingPage;
