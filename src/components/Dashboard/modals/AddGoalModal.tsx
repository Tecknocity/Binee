import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { NewGoal } from '../../../types/dashboard';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="space-y-5">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Target size={28} className="text-accent" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Goal Name */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Goal Name
          </label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => { setName(e.target.value); setError(''); }} 
            placeholder="e.g., Hit $100K MRR"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Target Value */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Target Value
          </label>
          <input 
            type="number" 
            value={target} 
            onChange={(e) => { setTarget(e.target.value); setError(''); }} 
            placeholder="e.g., 100000"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Unit
          </label>
          <select 
            value={unit} 
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-5 py-2.5 gradient-primary rounded-xl text-white text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all"
          >
            Create Goal
          </button>
        </div>
      </div>
    </Modal>
  );
};
