'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ChevronDown, Plus, Check } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!workspace) return null;

  const initials = workspace.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
          <span className="text-accent text-[10px] font-bold">{initials}</span>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{workspace.name}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-navy-light border border-border rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted/60">
            Workspaces
          </p>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                switchWorkspace(ws.id);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
                <span className="text-accent text-[9px] font-bold">
                  {ws.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-sm text-text-primary truncate block">{ws.name}</span>
                <span className="text-[10px] text-text-muted capitalize">{ws.plan} plan</span>
              </div>
              {ws.id === workspace.id && <Check className="w-4 h-4 text-accent shrink-0" />}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-surface-hover transition-colors text-text-secondary">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Create workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
