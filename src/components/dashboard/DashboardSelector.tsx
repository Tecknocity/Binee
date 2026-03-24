'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, LayoutDashboard, Pencil, Copy, Trash2 } from 'lucide-react';
import type { Dashboard } from '@/types/database';

interface DashboardSelectorProps {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function DashboardSelector({
  dashboards,
  activeDashboard,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: DashboardSelectorProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
        setRenamingId(null);
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

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  function handleCreate() {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setCreating(false);
      setOpen(false);
    }
  }

  function handleRename(id: string) {
    if (renameValue.trim() && onRename) {
      onRename(id, renameValue.trim());
      setRenamingId(null);
      setRenameValue('');
    }
  }

  function startRename(d: Dashboard) {
    setRenamingId(d.id);
    setRenameValue(d.name);
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
        <div className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-navy-light border border-border shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            {dashboards.map((d) => (
              <div key={d.id} className="group flex items-center hover:bg-surface-hover transition-colors">
                {renamingId === d.id ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 w-full">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(d.id);
                        if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                      }}
                      className="flex-1 bg-navy-base border border-border rounded-lg px-3 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => handleRename(d.id)}
                      aria-label="Confirm rename"
                      className="p-1 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onSelect(d.id);
                        setOpen(false);
                      }}
                      className="flex-1 flex items-center gap-3 px-4 py-2.5"
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

                    {/* Action buttons — visible on hover */}
                    <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRename && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(d); }}
                          aria-label={`Rename ${d.name}`}
                          className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDuplicate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDuplicate(d.id); setOpen(false); }}
                          aria-label={`Duplicate ${d.name}`}
                          className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && !d.is_default && dashboards.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(d.id); setOpen(false); }}
                          aria-label={`Delete ${d.name}`}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
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
