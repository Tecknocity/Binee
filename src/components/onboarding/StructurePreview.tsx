'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Folder,
  List,
  Circle,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Pencil,
  Rocket,
  Lightbulb,
  Puzzle,
} from 'lucide-react';
import type { SetupPlan, StatusPlan } from '@/lib/setup/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StructurePreviewProps {
  plan: SetupPlan;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  /** Called when the plan is modified in-place (editable mode) */
  onPlanChange?: (plan: SetupPlan) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StructurePreview({ plan, onApprove, onEdit, onReject, onPlanChange }: StructurePreviewProps) {
  // Count totals for summary
  let totalFolders = 0;
  let totalLists = 0;
  let totalStatuses = 0;
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      totalFolders++;
      for (const list of folder.lists) {
        totalLists++;
        totalStatuses += list.statuses.length;
      }
    }
  }

  // Helper to mutate plan and notify parent
  const updatePlan = (updater: (draft: SetupPlan) => void) => {
    const clone = JSON.parse(JSON.stringify(plan)) as SetupPlan;
    updater(clone);
    onPlanChange?.(clone);
  };

  // --- Space operations ---
  const renameSpace = (si: number, name: string) => {
    updatePlan((d) => { d.spaces[si].name = name; });
  };
  const deleteSpace = (si: number) => {
    updatePlan((d) => { d.spaces.splice(si, 1); });
  };
  const addSpace = () => {
    updatePlan((d) => {
      d.spaces.push({
        name: `New Space ${d.spaces.length + 1}`,
        folders: [{ name: 'General', lists: [{ name: 'Tasks', statuses: defaultStatuses() }] }],
      });
    });
  };

  // --- Folder operations ---
  const renameFolder = (si: number, fi: number, name: string) => {
    updatePlan((d) => { d.spaces[si].folders[fi].name = name; });
  };
  const deleteFolder = (si: number, fi: number) => {
    updatePlan((d) => { d.spaces[si].folders.splice(fi, 1); });
  };
  const addFolder = (si: number) => {
    updatePlan((d) => {
      d.spaces[si].folders.push({
        name: `New Folder`,
        lists: [{ name: 'Tasks', statuses: defaultStatuses() }],
      });
    });
  };

  // --- List operations ---
  const renameList = (si: number, fi: number, li: number, name: string) => {
    updatePlan((d) => { d.spaces[si].folders[fi].lists[li].name = name; });
  };
  const deleteList = (si: number, fi: number, li: number) => {
    updatePlan((d) => { d.spaces[si].folders[fi].lists.splice(li, 1); });
  };
  const addList = (si: number, fi: number) => {
    updatePlan((d) => {
      d.spaces[si].folders[fi].lists.push({
        name: 'New List',
        statuses: defaultStatuses(),
      });
    });
  };

  const editable = !!onPlanChange;

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6 overflow-hidden">
      {/* Header */}
      <div className="py-4 shrink-0">
        <h2 className="text-xl font-semibold text-text-primary">
          {editable ? 'Edit Workspace Structure' : 'Proposed Workspace Structure'}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          {plan.spaces.length} {plan.spaces.length === 1 ? 'space' : 'spaces'} &middot;{' '}
          {totalFolders} {totalFolders === 1 ? 'folder' : 'folders'} &middot;{' '}
          {totalLists} {totalLists === 1 ? 'list' : 'lists'} &middot;{' '}
          {totalStatuses} statuses
          {editable && (
            <span className="text-accent ml-2">— click names to rename, use +/x to add or remove</span>
          )}
        </p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
        {plan.spaces.map((space, si) => (
          <TreeNode
            key={`space-${si}`}
            icon={<FolderOpen className="w-4 h-4 text-accent" />}
            label={space.name}
            badge="Space"
            badgeColor="bg-accent/15 text-accent"
            defaultOpen
            editable={editable}
            onRename={(name) => renameSpace(si, name)}
            onDelete={plan.spaces.length > 1 ? () => deleteSpace(si) : undefined}
          >
            {space.folders.map((folder, fi) => (
              <TreeNode
                key={`folder-${si}-${fi}`}
                icon={<Folder className="w-4 h-4 text-warning" />}
                label={folder.name}
                badge="Folder"
                badgeColor="bg-warning/15 text-warning"
                editable={editable}
                onRename={(name) => renameFolder(si, fi, name)}
                onDelete={space.folders.length > 1 ? () => deleteFolder(si, fi) : undefined}
              >
                {folder.lists.map((list, li) => (
                  <TreeNode
                    key={`list-${si}-${fi}-${li}`}
                    icon={<List className="w-4 h-4 text-info" />}
                    label={list.name}
                    badge={`${list.statuses.length} statuses`}
                    badgeColor="bg-info/15 text-info"
                    editable={editable}
                    onRename={(name) => renameList(si, fi, li, name)}
                    onDelete={folder.lists.length > 1 ? () => deleteList(si, fi, li) : undefined}
                  >
                    {list.statuses.map((status, sti) => (
                      <div
                        key={sti}
                        className="flex items-center gap-2 py-1 pl-2 text-sm text-text-secondary"
                      >
                        <Circle
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: status.color, fill: status.color }}
                        />
                        <span>{status.name}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface text-text-muted">
                          {status.type}
                        </span>
                      </div>
                    ))}
                    {list.description && (
                      <p className="text-xs text-text-muted pl-2 pb-1 italic">{list.description}</p>
                    )}
                  </TreeNode>
                ))}
                {/* Add list button */}
                {editable && (
                  <button
                    onClick={() => addList(si, fi)}
                    className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add List
                  </button>
                )}
              </TreeNode>
            ))}
            {/* Add folder button */}
            {editable && (
              <button
                onClick={() => addFolder(si)}
                className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Folder
              </button>
            )}
          </TreeNode>
        ))}

        {/* Add space button */}
        {editable && (
          <button
            onClick={addSpace}
            className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-border
              text-sm text-text-muted hover:border-accent/40 hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Space
          </button>
        )}

        {/* Recommended ClickApps */}
        {plan.recommended_clickapps.length > 0 && (
          <TreeNode
            icon={<Puzzle className="w-4 h-4 text-success" />}
            label="Recommended ClickApps"
            badge={`${plan.recommended_clickapps.length}`}
            badgeColor="bg-success/15 text-success"
          >
            <div className="flex flex-wrap gap-1.5 py-1 pl-2">
              {plan.recommended_clickapps.map((app, i) => (
                <span
                  key={i}
                  className="text-xs font-medium px-2 py-1 rounded-md bg-success/10 text-success border border-success/20"
                >
                  {app}
                </span>
              ))}
            </div>
          </TreeNode>
        )}

        {/* AI Reasoning */}
        {plan.reasoning && (
          <div className="bg-accent/5 border border-accent/15 rounded-xl p-3 mt-2">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-accent mb-1">Why this structure?</p>
                <p className="text-xs text-text-secondary leading-relaxed">{plan.reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-muted hover:text-error transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Start Over
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg
              hover:border-accent/40 hover:text-text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Revise with AI
          </button>
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg
              hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >
            <Rocket className="w-4 h-4" />
            Approve &amp; Build
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default statuses for new lists
// ---------------------------------------------------------------------------

function defaultStatuses(): StatusPlan[] {
  return [
    { name: 'To Do', color: '#d3d3d3', type: 'open' },
    { name: 'In Progress', color: '#4194f6', type: 'active' },
    { name: 'Done', color: '#6bc950', type: 'done' },
    { name: 'Closed', color: '#6b6b80', type: 'closed' },
  ];
}

// ---------------------------------------------------------------------------
// Tree Node (with optional inline editing)
// ---------------------------------------------------------------------------

function TreeNode({
  icon,
  label,
  badge,
  badgeColor,
  defaultOpen = false,
  children,
  editable = false,
  onRename,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  editable?: boolean;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = !!children;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onRename?.(trimmed);
    } else {
      setEditValue(label);
    }
    setEditing(false);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg
          hover:bg-surface-hover transition-colors group ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => hasChildren && setOpen(!open)}
          className="flex-shrink-0"
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        {/* Icon */}
        <span className="flex-shrink-0" onClick={() => hasChildren && setOpen(!open)}>
          {icon}
        </span>

        {/* Label or inline edit */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditValue(label); setEditing(false); }
            }}
            className="flex-1 min-w-0 text-sm font-medium text-text-primary bg-surface border border-accent/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <span
            className={`text-sm font-medium text-text-primary flex-1 min-w-0 truncate ${
              editable ? 'cursor-text hover:text-accent' : ''
            }`}
            onClick={() => hasChildren && !editable && setOpen(!open)}
            onDoubleClick={() => {
              if (editable && onRename) {
                setEditValue(label);
                setEditing(true);
              }
            }}
          >
            {label}
          </span>
        )}

        {/* Badge */}
        {badge && !editing && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
            {badge}
          </span>
        )}

        {/* Edit/Delete buttons (visible on hover when editable) */}
        {editable && !editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onRename && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditValue(label);
                  setEditing(true);
                }}
                className="p-0.5 text-text-muted hover:text-accent transition-colors"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-0.5 text-text-muted hover:text-error transition-colors"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {open && hasChildren && <div className="ml-6 border-l border-border/50 pl-2">{children}</div>}
    </div>
  );
}
