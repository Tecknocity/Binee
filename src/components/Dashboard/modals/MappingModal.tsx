import React, { useState } from 'react';
import { Modal } from './Modal';
import { DataMapping, StageMapping, StatusMapping } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { ChevronDown } from 'lucide-react';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataMapping: DataMapping;
  onSave?: (dataMapping: DataMapping) => void;
}

type MappingTab = 'crm' | 'projectManagement';

// Binee standard stages for CRM
const BINEE_CRM_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

// Binee standard statuses for Project Management
const BINEE_PROJECT_STATUSES = ['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled'];

export const MappingModal: React.FC<MappingModalProps> = ({ isOpen, onClose, dataMapping, onSave }) => {
  const [activeTab, setActiveTab] = useState<MappingTab>('crm');
  const [crmStages, setCrmStages] = useState<StageMapping[]>(dataMapping.crm.stages);
  const [projectStatuses, setProjectStatuses] = useState<StatusMapping[]>(dataMapping.projectManagement.statuses);
  const [editingCell, setEditingCell] = useState<{ type: 'crm' | 'project'; order: number } | null>(null);

  const handleCrmStageChange = (order: number, newBineeStage: string) => {
    setCrmStages(prev =>
      prev.map(stage =>
        stage.order === order ? { ...stage, ourStage: newBineeStage } : stage
      )
    );
    setEditingCell(null);
  };

  const handleProjectStatusChange = (order: number, newBineeStatus: string) => {
    setProjectStatuses(prev =>
      prev.map(status =>
        status.order === order ? { ...status, ourStatus: newBineeStatus } : status
      )
    );
    setEditingCell(null);
  };

  const handleSave = () => {
    const updatedMapping: DataMapping = {
      crm: {
        ...dataMapping.crm,
        stages: crmStages,
        lastUpdated: new Date().toISOString().split('T')[0],
      },
      projectManagement: {
        ...dataMapping.projectManagement,
        statuses: projectStatuses,
        lastUpdated: new Date().toISOString().split('T')[0],
      },
    };
    onSave?.(updatedMapping);
    alert('Mapping saved successfully!');
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  const dropdownButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    background: theme.colors.primaryLight,
    border: `1px solid ${theme.colors.primaryBorder}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.primary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    minWidth: '140px',
    justifyContent: 'space-between',
  };

  const dropdownMenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: theme.spacing.xs,
    background: theme.colors.darkSolid,
    border: `1px solid ${theme.colors.mutedBorder}`,
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.dropdown,
    zIndex: 100,
    overflow: 'hidden',
  };

  const dropdownItemStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    cursor: 'pointer',
    transition: `background ${theme.transitions.fast}`,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Data Mapping Configuration" width="800px">
      <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing['xl'] }}>
        <button onClick={() => setActiveTab('crm')} style={{ padding: `${theme.spacing.md} ${theme.spacing.lg}`, background: activeTab === 'crm' ? theme.colors.primaryLight : 'transparent', border: activeTab === 'crm' ? `1px solid ${theme.colors.primaryBorder}` : `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: activeTab === 'crm' ? theme.colors.primary : theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>CRM Stages</button>
        <button onClick={() => setActiveTab('projectManagement')} style={{ padding: `${theme.spacing.md} ${theme.spacing.lg}`, background: activeTab === 'projectManagement' ? theme.colors.primaryLight : 'transparent', border: activeTab === 'projectManagement' ? `1px solid ${theme.colors.primaryBorder}` : `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: activeTab === 'projectManagement' ? theme.colors.primary : theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Project Statuses</button>
      </div>
      {activeTab === 'crm' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>CRM Pipeline Stage Mapping</h3>
            <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>Last updated: {dataMapping.crm.lastUpdated}</span>
          </div>
          <div style={{ background: theme.colors.cardInner, borderRadius: theme.borderRadius.lg, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
              <div>Order</div><div>Company Stage</div><div></div><div>Binee Stage</div>
            </div>
            {crmStages.map((stage) => (
              <div key={stage.order} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, alignItems: 'center' }}>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>{stage.order}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{stage.theirStage}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>→</div>
                <div style={dropdownStyle}>
                  <button
                    onClick={() => setEditingCell(editingCell?.type === 'crm' && editingCell?.order === stage.order ? null : { type: 'crm', order: stage.order })}
                    style={dropdownButtonStyle}
                  >
                    {stage.ourStage}
                    <ChevronDown size={16} />
                  </button>
                  {editingCell?.type === 'crm' && editingCell?.order === stage.order && (
                    <div style={dropdownMenuStyle}>
                      {BINEE_CRM_STAGES.map((bineeStage) => (
                        <div
                          key={bineeStage}
                          onClick={() => handleCrmStageChange(stage.order, bineeStage)}
                          style={{
                            ...dropdownItemStyle,
                            background: stage.ourStage === bineeStage ? theme.colors.primaryLight : 'transparent',
                            color: stage.ourStage === bineeStage ? theme.colors.primary : theme.colors.text,
                          }}
                          onMouseEnter={(e) => {
                            if (stage.ourStage !== bineeStage) {
                              e.currentTarget.style.background = theme.colors.dark;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (stage.ourStage !== bineeStage) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
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
      {activeTab === 'projectManagement' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Project Status Mapping</h3>
            <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>Last updated: {dataMapping.projectManagement.lastUpdated}</span>
          </div>
          <div style={{ background: theme.colors.cardInner, borderRadius: theme.borderRadius.lg, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
              <div>Order</div><div>Company Status</div><div></div><div>Binee Status</div>
            </div>
            {projectStatuses.map((status) => (
              <div key={status.order} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, alignItems: 'center' }}>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>{status.order}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{status.theirStatus}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>→</div>
                <div style={dropdownStyle}>
                  <button
                    onClick={() => setEditingCell(editingCell?.type === 'project' && editingCell?.order === status.order ? null : { type: 'project', order: status.order })}
                    style={dropdownButtonStyle}
                  >
                    {status.ourStatus}
                    <ChevronDown size={16} />
                  </button>
                  {editingCell?.type === 'project' && editingCell?.order === status.order && (
                    <div style={dropdownMenuStyle}>
                      {BINEE_PROJECT_STATUSES.map((bineeStatus) => (
                        <div
                          key={bineeStatus}
                          onClick={() => handleProjectStatusChange(status.order, bineeStatus)}
                          style={{
                            ...dropdownItemStyle,
                            background: status.ourStatus === bineeStatus ? theme.colors.primaryLight : 'transparent',
                            color: status.ourStatus === bineeStatus ? theme.colors.primary : theme.colors.text,
                          }}
                          onMouseEnter={(e) => {
                            if (status.ourStatus !== bineeStatus) {
                              e.currentTarget.style.background = theme.colors.dark;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (status.ourStatus !== bineeStatus) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing['2xl'], paddingTop: theme.spacing['xl'], borderTop: `1px solid ${theme.colors.mutedBorder}` }}>
        <button onClick={onClose} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.lg, color: theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Close</button>
        <button onClick={handleSave} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: theme.colors.gradient, border: 'none', borderRadius: theme.borderRadius.lg, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Save Changes</button>
      </div>
    </Modal>
  );
};
