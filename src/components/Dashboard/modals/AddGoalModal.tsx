import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { NewGoal } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (goal: NewGoal) => void;
}

const UNITS = ['USD', 'Customers', 'Users', 'Percentage', 'Projects', 'Tasks'];

export const AddGoalModal: React.FC<AddGoalModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('USD');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) { setName(''); setTarget(''); setUnit('USD'); setError(''); }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) { setError('Please enter a goal name'); return; }
    if (!target || isNaN(Number(target)) || Number(target) <= 0) { setError('Please enter a valid target value'); return; }
    onSubmit({ name: name.trim(), target, unit });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Goal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing['xl'] }}>
        {error && <div style={{ padding: theme.spacing.md, background: theme.colors.dangerLight, border: `1px solid ${theme.colors.dangerBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.danger, fontSize: theme.fontSize.base }}>{error}</div>}
        <div>
          <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Goal Name</label>
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g., Hit $100K MRR" style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Target Value</label>
          <input type="number" value={target} onChange={(e) => { setTarget(e.target.value); setError(''); }} placeholder="e.g., 100000" style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>Unit</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: '100%', padding: theme.spacing.md, background: theme.colors.cardInner, border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.md, color: theme.colors.text, fontSize: theme.fontSize.base }}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end', marginTop: theme.spacing.lg }}>
          <button onClick={onClose} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, borderRadius: theme.borderRadius.lg, color: theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: theme.colors.gradient, border: 'none', borderRadius: theme.borderRadius.lg, color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Create Goal</button>
        </div>
      </div>
    </Modal>
  );
};
