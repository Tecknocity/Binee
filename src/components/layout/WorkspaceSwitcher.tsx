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
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
          <span className="text-accent text-xs font-bold">{initials}</span>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{workspace.name}</p>
          <p className="text-xs text-text-muted capitalize">{workspace.plan} plan</p>
        </div>
        <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-navy-light border border-border rounded-lg shadow-xl z-50 py-1">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                switchWorkspace(ws.id);
                setOpen(false);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <div className="w-6 h-6 rounded bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                <span className="text-accent text-[10px] font-bold">
                  {ws.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <span className="text-sm text-text-primary truncate flex-1 text-left">{ws.name}</span>
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
