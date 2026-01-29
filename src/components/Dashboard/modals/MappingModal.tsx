import React, { useState } from 'react';
import { Modal } from './Modal';
import { DataMapping } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataMapping: DataMapping;
}

type MappingTab = 'crm' | 'projectManagement';

export const MappingModal: React.FC<MappingModalProps> = ({ isOpen, onClose, dataMapping }) => {
  const [activeTab, setActiveTab] = useState<MappingTab>('crm');

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
              <div>Order</div><div>Their Stage</div><div></div><div>Our Stage</div>
            </div>
            {dataMapping.crm.stages.map((stage) => (
              <div key={stage.order} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, alignItems: 'center' }}>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>{stage.order}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{stage.theirStage}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>→</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: theme.fontWeight.semibold }}>{stage.ourStage}</div>
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
              <div>Order</div><div>Their Status</div><div></div><div>Our Status</div>
            </div>
            {dataMapping.projectManagement.statuses.map((status) => (
              <div key={status.order} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 1fr', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.mutedBorder}`, alignItems: 'center' }}>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>{status.order}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{status.theirStatus}</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>→</div>
                <div style={{ fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: theme.fontWeight.semibold }}>{status.ourStatus}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing['2xl'], paddingTop: theme.spacing['xl'], borderTop: `1px solid ${theme.colors.mutedBorder}` }}>
        <button onClick={onClose} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.lg, color: theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Close</button>
        <button onClick={() => alert('Saved!')} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: theme.colors.gradient, border: 'none', borderRadius: theme.borderRadius.lg, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Save Changes</button>
      </div>
    </Modal>
  );
};
