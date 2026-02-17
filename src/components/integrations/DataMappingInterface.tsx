import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const BINEE_SALES_STAGES = [
  'Lead',
  'Qualified',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

const BINEE_PROJECT_STAGES = [
  'Not Started',
  'In Progress',
  'Review',
  'Completed',
  'On Hold',
];

interface SourceStage {
  id: string;
  name: string;
  type: 'sales' | 'project';
}

const MOCK_SOURCE_STAGES: Record<string, SourceStage[]> = {
  hubspot: [
    { id: 'hs1', name: 'New Contact', type: 'sales' },
    { id: 'hs2', name: 'Appointment Scheduled', type: 'sales' },
    { id: 'hs3', name: 'Qualified to Buy', type: 'sales' },
    { id: 'hs4', name: 'Presentation Scheduled', type: 'sales' },
    { id: 'hs5', name: 'Decision Maker Bought-In', type: 'sales' },
    { id: 'hs6', name: 'Contract Sent', type: 'sales' },
    { id: 'hs7', name: 'Closed Won', type: 'sales' },
    { id: 'hs8', name: 'Closed Lost', type: 'sales' },
  ],
  clickup: [
    { id: 'cu1', name: 'Open', type: 'project' },
    { id: 'cu2', name: 'In Progress', type: 'project' },
    { id: 'cu3', name: 'In Review', type: 'project' },
    { id: 'cu4', name: 'Blocked', type: 'project' },
    { id: 'cu5', name: 'Done', type: 'project' },
    { id: 'cu6', name: 'Cancelled', type: 'project' },
  ],
  stripe: [
    { id: 'st1', name: 'Trial', type: 'sales' },
    { id: 'st2', name: 'Active', type: 'sales' },
    { id: 'st3', name: 'Past Due', type: 'sales' },
    { id: 'st4', name: 'Churned', type: 'sales' },
    { id: 'st5', name: 'Cancelled', type: 'sales' },
  ],
  quickbooks: [
    { id: 'qb1', name: 'Draft', type: 'project' },
    { id: 'qb2', name: 'Sent', type: 'project' },
    { id: 'qb3', name: 'Partially Paid', type: 'project' },
    { id: 'qb4', name: 'Paid', type: 'project' },
    { id: 'qb5', name: 'Overdue', type: 'project' },
  ],
};

const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
  hubspot: {
    hs1: 'Lead',
    hs2: 'Meeting',
    hs3: 'Qualified',
    hs4: 'Meeting',
    hs5: 'Negotiation',
    hs6: 'Proposal',
    hs7: 'Closed Won',
    hs8: 'Closed Lost',
  },
  clickup: {
    cu1: 'Not Started',
    cu2: 'In Progress',
    cu3: 'Review',
    cu4: 'On Hold',
    cu5: 'Completed',
    cu6: 'On Hold',
  },
  stripe: {
    st1: 'Lead',
    st2: 'Closed Won',
    st3: 'Negotiation',
    st4: 'Closed Lost',
    st5: 'Closed Lost',
  },
  quickbooks: {
    qb1: 'Not Started',
    qb2: 'In Progress',
    qb3: 'In Progress',
    qb4: 'Completed',
    qb5: 'Review',
  },
};

interface DataMappingInterfaceProps {
  slug: string;
  integrationName: string;
}

export const DataMappingInterface: React.FC<DataMappingInterfaceProps> = ({
  slug,
  integrationName,
}) => {
  const navigate = useNavigate();
  const sourceStages = MOCK_SOURCE_STAGES[slug] || [];
  const defaultMappings = DEFAULT_MAPPINGS[slug] || {};
  const stageType = sourceStages.length > 0 ? sourceStages[0].type : 'sales';
  const bineeStages =
    stageType === 'sales' ? BINEE_SALES_STAGES : BINEE_PROJECT_STAGES;

  const [mappings, setMappings] = useState<Record<string, string>>(defaultMappings);
  const [saved, setSaved] = useState(false);

  const completeness = useMemo(() => {
    if (sourceStages.length === 0) return 0;
    const mapped = sourceStages.filter(
      (s) => mappings[s.id] && mappings[s.id] !== ''
    ).length;
    return Math.round((mapped / sourceStages.length) * 100);
  }, [mappings, sourceStages]);

  const handleMappingChange = (sourceId: string, bineeStage: string) => {
    setMappings((prev) => ({ ...prev, [sourceId]: bineeStage }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setMappings(defaultMappings);
    setSaved(false);
  };

  if (sourceStages.length === 0) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/integrations/${slug}`)}
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to {integrationName}
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">
            No stages available for mapping.
          </p>
          <p className="text-sm mt-1">
            This integration does not have configurable stage mappings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/integrations/${slug}`)}
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Data Mapping: {integrationName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Map your {integrationName} stages to Binee standard{' '}
          {stageType === 'sales' ? 'sales' : 'project'} stages for unified
          reporting.
        </p>
      </div>

      {/* Completeness */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Mapping Completeness
          </span>
          <Badge
            className={
              completeness === 100
                ? 'bg-success/15 text-success border-success/30 hover:bg-success/15'
                : 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/15'
            }
          >
            {completeness}%
          </Badge>
        </div>
        <Progress value={completeness} className="h-2" />
      </div>

      {/* Mapping Table */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Your {integrationName} Stages
          </h3>
          <div className="w-8" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Binee Standard Stages
          </h3>
        </div>

        <div className="space-y-3">
          {sourceStages.map((stage) => (
            <div
              key={stage.id}
              className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center bg-muted/30 rounded-lg px-4 py-3"
            >
              {/* Source Stage */}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {stage.name}
                </span>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>

              {/* Binee Stage Dropdown */}
              <Select
                value={mappings[stage.id] || ''}
                onValueChange={(value) => handleMappingChange(stage.id, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {bineeStages.map((bineeStage) => (
                    <SelectItem key={bineeStage} value={bineeStage}>
                      {bineeStage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw size={14} className="mr-2" />
          Reset to Default
        </Button>
        <Button
          className="gradient-primary text-white hover:opacity-90"
          onClick={handleSave}
        >
          {saved ? (
            <>
              <Check size={14} className="mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save size={14} className="mr-2" />
              Save Mapping
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default DataMappingInterface;
