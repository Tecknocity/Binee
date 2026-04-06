'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';

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
  /** Current workspace structure from ClickUp (for showing existing vs new) */
  existingStructure?: ExistingWorkspaceStructure | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StructurePreview({ plan, onApprove, onEdit, onReject, onPlanChange, existingStructure }: StructurePreviewProps) {
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

  // Build lookup for existing items (case-insensitive matching)
  const existingLookup = useMemo(() => {
    const spaces = new Map<string, { folders: Map<string, Set<string>> }>();
    if (!existingStructure?.spaces) return spaces;
    for (const space of existingStructure.spaces) {
      const folders = new Map<string, Set<string>>();
      for (const folder of space.folders) {
        const lists = new Set(folder.lists.map((l) => l.name.toLowerCase()));
        folders.set(folder.name.toLowerCase(), lists);
      }
      spaces.set(space.name.toLowerCase(), { folders });
    }
    return spaces;
  }, [existingStructure]);

  const spaceExists = (name: string) => existingLookup.has(name.toLowerCase());
  const folderExists = (spaceName: string, folderName: string) =>
    existingLookup.get(spaceName.toLowerCase())?.folders.has(folderName.toLowerCase()) ?? false;
  const listExists = (spaceName: string, folderName: string, listName: string) =>
    existingLookup.get(spaceName.toLowerCase())?.folders.get(folderName.toLowerCase())?.has(listName.toLowerCase()) ?? false;

  // Count new vs existing
  let newItems = 0;
  let existingItems = 0;
  for (const space of plan.spaces) {
    if (spaceExists(space.name)) existingItems++; else newItems++;
    for (const folder of space.folders) {
      if (folderExists(space.name, folder.name)) existingItems++; else newItems++;
      for (const list of folder.lists) {
        if (listExists(space.name, folder.name, list.name)) existingItems++; else newItems++;
      }
    }
  }
  const hasExisting = existingItems > 0;

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

  // --- Status operations ---
  const renameStatus = (si: number, fi: number, li: number, sti: number, name: string) => {
    updatePlan((d) => { d.spaces[si].folders[fi].lists[li].statuses[sti].name = name; });
  };
  const deleteStatus = (si: number, fi: number, li: number, sti: number) => {
    updatePlan((d) => { d.spaces[si].folders[fi].lists[li].statuses.splice(sti, 1); });
  };
  const addStatus = (si: number, fi: number, li: number) => {
    updatePlan((d) => {
      d.spaces[si].folders[fi].lists[li].statuses.push({
        name: 'New Status',
        color: '#a0a0b5',
        type: 'active',
      });
    });
  };
  const changeStatusType = (si: number, fi: number, li: number, sti: number, type: StatusPlan['type']) => {
    updatePlan((d) => {
      d.spaces[si].folders[fi].lists[li].statuses[sti].type = type;
      // Auto-assign a default color based on type
      const typeColors: Record<string, string> = { open: '#d3d3d3', active: '#4194f6', done: '#6bc950', closed: '#6b6b80' };
      d.spaces[si].folders[fi].lists[li].statuses[sti].color = typeColors[type] || '#a0a0b5';
    });
  };

  const editable = !!onPlanChange;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="max-w-3xl mx-auto w-full px-4 flex flex-col flex-1 min-h-0">
        {/* Header with summary */}
        <div className="py-5 shrink-0">
          <h2 className="text-xl font-semibold text-[#F0F0F5] mb-2">
            {editable ? 'Edit Workspace Structure' : 'Proposed Workspace Structure'}
          </h2>

          {/* Summary badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#854DF9]/10 text-[#854DF9] font-medium">
              <FolderOpen className="w-3 h-3" />
              {plan.spaces.length} {plan.spaces.length === 1 ? 'space' : 'spaces'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 text-warning font-medium">
              <Folder className="w-3 h-3" />
              {totalFolders} {totalFolders === 1 ? 'folder' : 'folders'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-info/10 text-info font-medium">
              <List className="w-3 h-3" />
              {totalLists} {totalLists === 1 ? 'list' : 'lists'}
            </span>
            {hasExisting && (
              <>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-success/10 text-success font-medium">
                  {newItems} new
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#6B6B80]/10 text-[#6B6B80] font-medium">
                  {existingItems} existing (will skip)
                </span>
              </>
            )}
          </div>

          {editable && (
            <p className="text-xs text-[#6B6B80] mt-2">
              Click names to rename, use +/x buttons to add or remove items.
            </p>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-2">
          {plan.spaces.map((space, si) => {
            const sExists = spaceExists(space.name);
            return (
            <TreeNode
              key={`space-${si}`}
              icon={<FolderOpen className="w-4 h-4 text-[#854DF9]" />}
              label={space.name}
              badge="Space"
              badgeColor="bg-[#854DF9]/15 text-[#854DF9]"
              defaultOpen
              editable={editable}
              onRename={(name) => renameSpace(si, name)}
              onDelete={plan.spaces.length > 1 ? () => deleteSpace(si) : undefined}
              existsInWorkspace={hasExisting ? sExists : undefined}
            >
              {space.folders.map((folder, fi) => {
                const fExists = folderExists(space.name, folder.name);
                return (
                <TreeNode
                  key={`folder-${si}-${fi}`}
                  icon={<Folder className="w-4 h-4 text-warning" />}
                  label={folder.name}
                  badge="Folder"
                  badgeColor="bg-warning/15 text-warning"
                  editable={editable}
                  onRename={(name) => renameFolder(si, fi, name)}
                  onDelete={space.folders.length > 1 ? () => deleteFolder(si, fi) : undefined}
                  existsInWorkspace={hasExisting ? fExists : undefined}
                >
                  {folder.lists.map((list, li) => {
                    const lExists = listExists(space.name, folder.name, list.name);
                    return (
                    <TreeNode
                      key={`list-${si}-${fi}-${li}`}
                      icon={<List className="w-4 h-4 text-info" />}
                      label={list.name}
                      badge={`${list.statuses.length} statuses`}
                      badgeColor="bg-info/15 text-info"
                      editable={editable}
                      onRename={(name) => renameList(si, fi, li, name)}
                      onDelete={folder.lists.length > 1 ? () => deleteList(si, fi, li) : undefined}
                      existsInWorkspace={hasExisting ? lExists : undefined}
                    >
                      {list.statuses.map((status, sti) => (
                        <StatusRow
                          key={sti}
                          status={status}
                          editable={editable}
                          canDelete={list.statuses.length > 2}
                          onRename={(name) => renameStatus(si, fi, li, sti, name)}
                          onDelete={() => deleteStatus(si, fi, li, sti)}
                          onChangeType={(type) => changeStatusType(si, fi, li, sti, type)}
                        />
                      ))}
                      {editable && (
                        <button
                          onClick={() => addStatus(si, fi, li)}
                          className="flex items-center gap-1.5 py-1 pl-2 text-xs text-[#6B6B80] hover:text-[#854DF9] transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Status
                        </button>
                      )}
                      {list.description && (
                        <p className="text-xs text-[#6B6B80] pl-2 pb-1 italic">{list.description}</p>
                      )}
                    </TreeNode>
                    );
                  })}
                  {/* Add list button */}
                  {editable && (
                    <button
                      onClick={() => addList(si, fi)}
                      className="flex items-center gap-1.5 py-1 pl-2 text-xs text-[#6B6B80] hover:text-[#854DF9] transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add List
                    </button>
                  )}
                </TreeNode>
                );
              })}
              {/* Add folder button */}
              {editable && (
                <button
                  onClick={() => addFolder(si)}
                  className="flex items-center gap-1.5 py-1 pl-2 text-xs text-[#6B6B80] hover:text-[#854DF9] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Folder
                </button>
              )}
            </TreeNode>
            );
          })}

          {/* Add space button */}
          {editable && (
            <button
              onClick={addSpace}
              className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-[#2A2A3A]
                text-sm text-[#6B6B80] hover:border-[#854DF9]/40 hover:text-[#854DF9] transition-colors"
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
            <div className="bg-[#854DF9]/5 border border-[#854DF9]/15 rounded-xl p-3 mt-2">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-[#854DF9] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[#854DF9] mb-1">Why this structure?</p>
                  <p className="text-xs text-[#A0A0B5] leading-relaxed">{plan.reasoning}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons - sticky bottom */}
        <div className="flex items-center justify-between py-4 border-t border-[#2A2A3A] shrink-0 gap-3">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-error/70 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Start Over
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-[#A0A0B5] border border-[#2A2A3A] rounded-xl
                hover:border-[#854DF9]/40 hover:text-[#F0F0F5] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Revise with AI
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#854DF9] text-white text-sm font-semibold rounded-xl
                hover:bg-[#9D6FFA] transition-colors"
            >
              <Rocket className="w-4 h-4" />
              Approve &amp; Build
            </button>
          </div>
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
  existsInWorkspace,
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
  /** undefined = don't show indicator, true = exists, false = new */
  existsInWorkspace?: boolean;
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
          hover:bg-[#1A1A25] transition-colors group ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => hasChildren && setOpen(!open)}
          className="flex-shrink-0"
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#6B6B80]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-[#6B6B80]" />
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
            className="flex-1 min-w-0 text-sm font-medium text-[#F0F0F5] bg-[#12121A] border border-[#854DF9]/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#854DF9]"
          />
        ) : (
          <span
            className={`text-sm font-medium text-[#F0F0F5] flex-1 min-w-0 truncate ${
              editable ? 'cursor-text hover:text-[#854DF9]' : ''
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
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
            {badge}
          </span>
        )}

        {/* Exists / New indicator */}
        {existsInWorkspace !== undefined && !editing && (
          existsInWorkspace ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-[#6B6B80]/10 text-[#6B6B80]">
              exists - will skip
            </span>
          ) : (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-success/10 text-success">
              new
            </span>
          )
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
                className="p-0.5 text-[#6B6B80] hover:text-[#854DF9] transition-colors"
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
                className="p-0.5 text-[#6B6B80] hover:text-error transition-colors"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {open && hasChildren && <div className="ml-6 border-l border-[#2A2A3A]/50 pl-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Row (editable)
// ---------------------------------------------------------------------------

const STATUS_TYPES: Array<{ value: StatusPlan['type']; label: string; color: string }> = [
  { value: 'open', label: 'Open', color: '#d3d3d3' },
  { value: 'active', label: 'Active', color: '#4194f6' },
  { value: 'done', label: 'Done', color: '#6bc950' },
  { value: 'closed', label: 'Closed', color: '#6b6b80' },
];

function StatusRow({
  status,
  editable,
  canDelete,
  onRename,
  onDelete,
  onChangeType,
}: {
  status: StatusPlan;
  editable: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onChangeType: (type: StatusPlan['type']) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(status.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== status.name) {
      onRename(trimmed);
    } else {
      setEditValue(status.name);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-1 pl-2 text-sm text-[#A0A0B5] group/status">
      <Circle
        className="w-3 h-3 flex-shrink-0"
        style={{ color: status.color, fill: status.color }}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setEditValue(status.name); setEditing(false); }
          }}
          className="flex-1 min-w-0 text-sm text-[#F0F0F5] bg-[#12121A] border border-[#854DF9]/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#854DF9]"
        />
      ) : (
        <span
          className={`flex-1 min-w-0 truncate ${editable ? 'cursor-text hover:text-[#854DF9]' : ''}`}
          onDoubleClick={() => {
            if (editable) {
              setEditValue(status.name);
              setEditing(true);
            }
          }}
        >
          {status.name}
        </span>
      )}

      {editable ? (
        <select
          value={status.type}
          onChange={(e) => onChangeType(e.target.value as StatusPlan['type'])}
          className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#12121A] text-[#6B6B80] border-none outline-none cursor-pointer hover:text-[#854DF9] appearance-none"
          title="Change status type"
        >
          {STATUS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      ) : (
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#12121A] text-[#6B6B80]">
          {status.type}
        </span>
      )}

      {editable && !editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover/status:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => { setEditValue(status.name); setEditing(true); }}
            className="p-0.5 text-[#6B6B80] hover:text-[#854DF9] transition-colors"
            title="Rename status"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-0.5 text-[#6B6B80] hover:text-error transition-colors"
              title="Remove status"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
