import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { theme } from '../../../styles/theme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = '500px' }) => {
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscapeKey]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width, maxWidth: '90vw', maxHeight: '85vh', background: theme.colors.darkSolid, borderRadius: theme.borderRadius['2xl'], border: `1px solid ${theme.colors.mutedBorder}`, boxShadow: theme.shadows.dropdown, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing['xl'], borderBottom: `1px solid ${theme.colors.mutedBorder}` }}>
          <h2 id="modal-title" style={{ fontSize: theme.fontSize['3xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{title}</h2>
          <button onClick={onClose} aria-label="Close modal" style={{ width: '36px', height: '36px', borderRadius: theme.borderRadius.md, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.textSecondary }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: theme.spacing['xl'], overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
};
