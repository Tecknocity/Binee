import React, { useState } from 'react';
import { Modal } from './Modal';
import { DataMapping, StageMapping, StatusMapping } from '../../../types/dashboard';
import { ChevronDown, Database, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataMapping: DataMapping;
  onSave?: (dataMapping: DataMapping) => void;
}

type MappingTab = 'crm' | 'projectManagement';

const BINEE_CRM_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const BINEE_PROJECT_STATUSES = ['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'];

export const MappingModal: React.FC<MappingModalProps> = ({ isOpen, onClose, dataMapping, onSave }) => {
  const [activeTab, setActiveTab] = useState<MappingTab>('crm');
  const [crmStages, setCrmStages] = useState<StageMapping[]>(dataMapping.crm.stages);
  const [projectStatuses, setProjectStatuses] = useState<StatusMapping[]>(dataMapping.projectManagement.statuses);
  const [editingCell, setEditingCell] = useState<{ type: 'crm' | 'project'; order: number } | null>(null);

  const handleCrmStageChange = (order: number, newBineeStage: string) => {
    setCrmStages(prev => prev.map(stage => stage.order === order ? { ...stage, ourStage: newBineeStage } : stage));
    setEditingCell(null);
  };

  const handleProjectStatusChange = (order: number, newBineeStatus: string) => {
    setProjectStatuses(prev => prev.map(status => status.order === order ? { ...status, ourStatus: newBineeStatus } : status));
    setEditingCell(null);
  };

  const handleSave = () => {
    const updatedMapping: DataMapping = {
      crm: { ...dataMapping.crm, stages: crmStages, lastUpdated: new Date().toISOString().split('T')[0] },
      projectManagement: { ...dataMapping.projectManagement, statuses: projectStatuses, lastUpdated: new Date().toISOString().split('T')[0] },
    };
    onSave?.(updatedMapping);
    alert('Mapping saved successfully!');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Mapping Configuration" width="800px">
      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('crm')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeTab === 'crm' 
              ? "bg-primary/15 border border-primary/30 text-primary" 
              : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <Database size={16} />
          CRM Stages
        </button>
        <button 
          onClick={() => setActiveTab('projectManagement')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
            activeTab === 'projectManagement' 
              ? "bg-primary/15 border border-primary/30 text-primary" 
              : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          <FolderKanban size={16} />
          Project Statuses
        </button>
      </div>

      {/* CRM Tab */}
      {activeTab === 'crm' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-foreground">CRM Pipeline Stage Mapping</h3>
            <span className="text-xs text-muted-foreground">Last updated: {dataMapping.crm.lastUpdated}</span>
          </div>
          
          <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_40px_1fr] gap-3 px-4 py-3 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
              <div>Order</div>
              <div>Company Stage</div>
              <div></div>
              <div>Binee Stage</div>
            </div>
            
            {/* Rows */}
            {crmStages.map((stage) => (
              <div key={stage.order} className="grid grid-cols-[60px_1fr_40px_1fr] gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 items-center">
                <div className="text-sm text-muted-foreground">{stage.order}</div>
                <div className="text-sm text-foreground">{stage.theirStage}</div>
                <div className="text-muted-foreground">→</div>
                <div className="relative">
                  <button
                    onClick={() => setEditingCell(editingCell?.type === 'crm' && editingCell?.order === stage.order ? null : { type: 'crm', order: stage.order })}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm font-medium min-w-[140px] hover:bg-primary/20 transition-colors"
                  >
                    {stage.ourStage}
                    <ChevronDown size={14} />
                  </button>
                  
                  {editingCell?.type === 'crm' && editingCell?.order === stage.order && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-card z-50 overflow-hidden animate-scale-in">
                      {BINEE_CRM_STAGES.map((bineeStage) => (
                        <div
                          key={bineeStage}
                          onClick={() => handleCrmStageChange(stage.order, bineeStage)}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer transition-colors",
                            stage.ourStage === bineeStage 
                              ? "bg-primary/15 text-primary" 
                              : "text-foreground hover:bg-secondary/50"
                          )}
                        >
                          {bineeStage}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Management Tab */}
      {activeTab === 'projectManagement' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-foreground">Project Status Mapping</h3>
            <span className="text-xs text-muted-foreground">Last updated: {dataMapping.projectManagement.lastUpdated}</span>
          </div>
          
          <div className="bg-background/50 rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_40px_1fr] gap-3 px-4 py-3 border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
              <div>Order</div>
              <div>Company Status</div>
              <div></div>
              <div>Binee Status</div>
            </div>
            
            {/* Rows */}
            {projectStatuses.map((status) => (
              <div key={status.order} className="grid grid-cols-[60px_1fr_40px_1fr] gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 items-center">
                <div className="text-sm text-muted-foreground">{status.order}</div>
                <div className="text-sm text-foreground">{status.theirStatus}</div>
                <div className="text-muted-foreground">→</div>
                <div className="relative">
                  <button
                    onClick={() => setEditingCell(editingCell?.type === 'project' && editingCell?.order === status.order ? null : { type: 'project', order: status.order })}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm font-medium min-w-[140px] hover:bg-primary/20 transition-colors"
                  >
                    {status.ourStatus}
                    <ChevronDown size={14} />
                  </button>
                  
                  {editingCell?.type === 'project' && editingCell?.order === status.order && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-card z-50 overflow-hidden animate-scale-in">
                      {BINEE_PROJECT_STATUSES.map((bineeStatus) => (
                        <div
                          key={bineeStatus}
                          onClick={() => handleProjectStatusChange(status.order, bineeStatus)}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer transition-colors",
                            status.ourStatus === bineeStatus 
                              ? "bg-primary/15 text-primary" 
                              : "text-foreground hover:bg-secondary/50"
                          )}
                        >
                          {bineeStatus}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
        <button 
          onClick={onClose}
          className="px-5 py-2.5 bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          Close
        </button>
        <button 
          onClick={handleSave}
          className="px-5 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all"
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
};
