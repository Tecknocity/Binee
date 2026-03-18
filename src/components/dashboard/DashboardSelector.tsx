'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, LayoutDashboard } from 'lucide-react';
import type { Dashboard } from '@/types/database';

interface DashboardSelectorProps {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}

export default function DashboardSelector({
  dashboards,
  activeDashboard,
  onSelect,
  onCreate,
}: DashboardSelectorProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  function handleCreate() {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setCreating(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-surface border border-border hover:bg-surface-hover transition-colors"
      >
        <LayoutDashboard className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-text-primary">
          {activeDashboard?.name ?? 'Select Dashboard'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-navy-light border border-border shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            {dashboards.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  onSelect(d.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors"
              >
                <div className="flex-1 text-left">
                  <p className="text-sm text-text-primary">{d.name}</p>
                  {d.is_default && (
                    <span className="text-xs text-text-muted">Default</span>
                  )}
                </div>
                {activeDashboard?.id === d.id && (
                  <Check className="w-4 h-4 text-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Dashboard name..."
                  className="flex-1 bg-navy-base border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleCreate}
                  aria-label="Confirm create dashboard"
                  className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors text-sm text-text-secondary"
              >
                <Plus className="w-4 h-4" />
                Create Dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
