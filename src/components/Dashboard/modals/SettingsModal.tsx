import React, { useState } from 'react';
import { Modal } from './Modal';
import { theme } from '../../../styles/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'notifications' | 'integrations' | 'security';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'security', label: 'Security' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="700px">
      <div style={{ display: 'flex', gap: theme.spacing['2xl'] }}>
        <div style={{ width: '180px', flexShrink: 0, borderRight: `1px solid ${theme.colors.mutedBorder}`, paddingRight: theme.spacing['xl'] }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ width: '100%', padding: `${theme.spacing.md} ${theme.spacing.lg}`, marginBottom: theme.spacing.sm, background: activeTab === tab.id ? theme.colors.primaryLight : 'transparent', border: 'none', borderRadius: theme.borderRadius.md, textAlign: 'left', color: activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium, cursor: 'pointer', transition: `all ${theme.transitions.normal}` }}>{tab.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {activeTab === 'general' && (
            <div>
              <h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing['xl'] }}>General Settings</h3>
              <div style={{ marginBottom: theme.spacing['xl'] }}>
                <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Company Name</label>
                <input type="text" defaultValue="Acme Corporation" style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }} />
              </div>
              <div style={{ marginBottom: theme.spacing['xl'] }}>
                <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Timezone</label>
                <select defaultValue="UTC-5" style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }}>
                  <option value="UTC-5">Eastern Time (UTC-5)</option>
                  <option value="UTC-8">Pacific Time (UTC-8)</option>
                  <option value="UTC+0">UTC</option>
                </select>
              </div>
              <div style={{ marginBottom: theme.spacing['xl'] }}>
                <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Currency</label>
                <select defaultValue="USD" style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          )}
          {activeTab === 'notifications' && <div><h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing['xl'] }}>Notification Preferences</h3><p style={{ color: theme.colors.textSecondary }}>Configure your notification preferences here.</p></div>}
          {activeTab === 'integrations' && <div><h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing['xl'] }}>Connected Integrations</h3><p style={{ color: theme.colors.textSecondary }}>Manage your connected apps and services.</p></div>}
          {activeTab === 'security' && <div><h3 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing['xl'] }}>Security Settings</h3><p style={{ color: theme.colors.textSecondary }}>Manage your security and authentication settings.</p></div>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md, marginTop: theme.spacing['2xl'], paddingTop: theme.spacing['xl'], borderTop: `1px solid ${theme.colors.mutedBorder}` }}>
        <button onClick={onClose} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.lg, color: theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onClose} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: theme.colors.gradient, border: 'none', borderRadius: theme.borderRadius.lg, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Save Changes</button>
      </div>
    </Modal>
  );
};
