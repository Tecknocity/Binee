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
  ArrowLeft,
  Tag,
  FileText,
  Target,
  AlertTriangle,
  Trash2,
  Settings2,
} from 'lucide-react';
import type { SetupPlan, StatusPlan } from '@/lib/setup/types';
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';
import type { ExecutionItem } from '@/lib/setup/executor';
import { getUnsupportedFeatures, getPlanCapabilities } from '@/lib/clickup/plan-capabilities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StructurePreviewProps {
  plan: SetupPlan;
  onApprove: () => void;
  onEdit: () => void;
  /** Called when the plan is modified in-place (editable mode) */
  onPlanChange?: (plan: SetupPlan) => void;
  /** Current workspace structure from ClickUp (for showing existing vs new) */
  existingStructure?: ExistingWorkspaceStructure | null;
  /** ClickUp plan tier for showing feature limitation warnings */
  planTier?: string;
  /** Items from previous builds that will be removed (not in current plan) */
  itemsToDelete?: ExecutionItem[];
  /** Approve with deletions confirmed */
  onApproveWithDeletions?: () => void;
  /** Approve but skip deletions (keep old items) */
  onApproveSkipDeletions?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StructurePreview({ plan, onApprove, onEdit, onPlanChange, existingStructure, planTier, itemsToDelete, onApproveWithDeletions, onApproveSkipDeletions }: StructurePreviewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasDeletions = itemsToDelete && itemsToDelete.length > 0;
  // Count totals for summary
  let totalFolders = 0;
  let totalLists = 0;
  let totalStatuses = 0;
  for (const space of plan.spaces) {
    // Count folderless lists
    if (space.lists) {
      for (const list of space.lists) {
        totalLists++;
        totalStatuses += list.statuses.length;
      }
    }
    // Count folders and their lists
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
    const spaces = new Map<string, { folders: Map<string, Set<string>>; lists: Set<string> }>();
    if (!existingStructure?.spaces) return spaces;
    for (const space of existingStructure.spaces) {
      const folders = new Map<string, Set<string>>();
      for (const folder of space.folders) {
        const lists = new Set(folder.lists.map((l) => l.name.toLowerCase()));
        folders.set(folder.name.toLowerCase(), lists);
      }
      const folderlessLists = new Set(
        (space.lists ?? []).map((l) => l.name.toLowerCase())
      );
      spaces.set(space.name.toLowerCase(), { folders, lists: folderlessLists });
    }
    return spaces;
  }, [existingStructure]);

  const spaceExists = (name: string) => existingLookup.has(name.toLowerCase());
  const folderExists = (spaceName: string, folderName: string) =>
    existingLookup.get(spaceName.toLowerCase())?.folders.has(folderName.toLowerCase()) ?? false;
  const listInFolderExists = (spaceName: string, folderName: string, listName: string) =>
    existingLookup.get(spaceName.toLowerCase())?.folders.get(folderName.toLowerCase())?.has(listName.toLowerCase()) ?? false;
  const folderlessListExists = (spaceName: string, listName: string) =>
    existingLookup.get(spaceName.toLowerCase())?.lists.has(listName.toLowerCase()) ?? false;

  // Count new vs existing
  let newItems = 0;
  let existingItems = 0;
  for (const space of plan.spaces) {
    if (spaceExists(space.name)) existingItems++; else newItems++;
    if (space.lists) {
      for (const list of space.lists) {
        if (folderlessListExists(space.name, list.name)) existingItems++; else newItems++;
      }
    }
    for (const folder of space.folders) {
      if (folderExists(space.name, folder.name)) existingItems++; else newItems++;
      for (const list of folder.lists) {
        if (listInFolderExists(space.name, folder.name, list.name)) existingItems++; else newItems++;
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
        folders: [],
        lists: [{ name: 'Tasks', statuses: defaultStatuses() }],
      });
    });
  };

  // --- Folderless list operations (lists directly in a space) ---
  const renameFolderlessList = (si: number, li: number, name: string) => {
    updatePlan((d) => { if (d.spaces[si].lists?.[li]) d.spaces[si].lists![li].name = name; });
  };
  const deleteFolderlessList = (si: number, li: number) => {
    updatePlan((d) => { d.spaces[si].lists?.splice(li, 1); });
  };
  const addFolderlessList = (si: number) => {
    updatePlan((d) => {
      if (!d.spaces[si].lists) d.spaces[si].lists = [];
      d.spaces[si].lists!.push({ name: 'New List', statuses: defaultStatuses() });
    });
  };

  // --- Folderless list status operations ---
  const renameFolderlessStatus = (si: number, li: number, sti: number, name: string) => {
    updatePlan((d) => { if (d.spaces[si].lists?.[li]) d.spaces[si].lists![li].statuses[sti].name = name; });
  };
  const deleteFolderlessStatus = (si: number, li: number, sti: number) => {
    updatePlan((d) => { d.spaces[si].lists?.[li]?.statuses.splice(sti, 1); });
  };
  const addFolderlessStatus = (si: number, li: number) => {
    updatePlan((d) => {
      d.spaces[si].lists?.[li]?.statuses.push({ name: 'New Status', color: '#a0a0b5', type: 'active' });
    });
  };
  const changeFolderlessStatusType = (si: number, li: number, sti: number, type: StatusPlan['type']) => {
    updatePlan((d) => {
      if (d.spaces[si].lists?.[li]) {
        d.spaces[si].lists![li].statuses[sti].type = type;
        const typeColors: Record<string, string> = { open: '#d3d3d3', active: '#4194f6', done: '#6bc950', closed: '#6b6b80' };
        d.spaces[si].lists![li].statuses[sti].color = typeColors[type] || '#a0a0b5';
      }
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

  // --- List operations (inside folders) ---
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

  // --- Tag operations ---
  const renameTag = (i: number, name: string) => {
    updatePlan((d) => { if (d.recommended_tags?.[i]) d.recommended_tags[i].name = name; });
  };
  const deleteTag = (i: number) => {
    updatePlan((d) => { d.recommended_tags?.splice(i, 1); });
  };
  const addTag = () => {
    updatePlan((d) => {
      if (!d.recommended_tags) d.recommended_tags = [];
      d.recommended_tags.push({ name: 'new-tag', tag_bg: '#854DF9', tag_fg: '#FFFFFF' });
    });
  };

  // --- Doc operations ---
  const renameDoc = (i: number, name: string) => {
    updatePlan((d) => { if (d.recommended_docs?.[i]) d.recommended_docs[i].name = name; });
  };
  const deleteDoc = (i: number) => {
    updatePlan((d) => { d.recommended_docs?.splice(i, 1); });
  };
  const addDoc = () => {
    updatePlan((d) => {
      if (!d.recommended_docs) d.recommended_docs = [];
      d.recommended_docs.push({ name: 'New Document', description: '' });
    });
  };

  // --- Goal operations ---
  const renameGoal = (i: number, name: string) => {
    updatePlan((d) => { if (d.recommended_goals?.[i]) d.recommended_goals[i].name = name; });
  };
  const deleteGoal = (i: number) => {
    updatePlan((d) => { d.recommended_goals?.splice(i, 1); });
  };
  const addGoal = () => {
    updatePlan((d) => {
      if (!d.recommended_goals) d.recommended_goals = [];
      d.recommended_goals.push({ name: 'New Goal', due_date: '', description: '' });
    });
  };

  const editable = !!onPlanChange;

  // Compute plan limitations to show warnings
  const unsupportedFeatures = planTier ? getUnsupportedFeatures(planTier) : [];
  const planCaps = planTier ? getPlanCapabilities(planTier) : null;
  const hasGoalsInPlan = (plan.recommended_goals?.length ?? 0) > 0;
  const goalsUnsupported = unsupportedFeatures.some(f => f.feature === 'Goals');
  const showGoalWarning = hasGoalsInPlan && goalsUnsupported;

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6 overflow-hidden">
      {/* Header */}
      <div className="py-4 shrink-0">
        <h2 className="text-xl font-semibold text-text-primary">
          {editable ? 'Edit Workspace Structure' : 'Proposed Workspace Structure'}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          {plan.spaces.length} {plan.spaces.length === 1 ? 'space' : 'spaces'} &middot;{' '}
          {totalLists} {totalLists === 1 ? 'list' : 'lists'}
          {totalFolders > 0 && (
            <> &middot; {totalFolders} {totalFolders === 1 ? 'folder' : 'folders'}</>
          )}
          {hasExisting && (
            <span className="text-text-muted ml-2">
              ({newItems} new, {existingItems} already exist)
            </span>
          )}
          {editable && (
            <span className="text-accent ml-2">- click names to rename, use +/x to add or remove</span>
          )}
        </p>
      </div>

      {/* Status manual setup info */}
      {totalStatuses > 0 && (
        <div className="mb-3 shrink-0 bg-info/10 border border-info/20 rounded-xl p-3 flex items-start gap-2.5">
          <Settings2 className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-info">
              Statuses require manual setup in ClickUp
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Spaces, folders, and lists will be created automatically. The {totalStatuses} recommended statuses below will need to be configured in ClickUp after the build.
              {' '}Set them once per Space and all lists will inherit them.
            </p>
          </div>
        </div>
      )}

      {/* Plan limitation warning */}
      {showGoalWarning && planCaps && (
        <div className="mb-3 shrink-0 bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">
              Goals are not available on your {planCaps.label} plan
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              The {plan.recommended_goals?.length} goal{(plan.recommended_goals?.length ?? 0) !== 1 ? 's' : ''} below will be skipped during build.
              Upgrade to Business or higher to use ClickUp Goals.
            </p>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
        {plan.spaces.map((space, si) => {
          const sExists = spaceExists(space.name);
          return (
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
            existsInWorkspace={hasExisting ? sExists : undefined}
          >
            {/* Folderless lists (directly in space) */}
            {space.lists?.map((list, li) => {
              const flExists = folderlessListExists(space.name, list.name);
              return (
              <TreeNode
                key={`flist-${si}-${li}`}
                icon={<List className="w-4 h-4 text-info" />}
                label={list.name}
                badge={`${list.statuses.length} statuses (manual)`}
                badgeColor="bg-info/15 text-info"
                editable={editable}
                onRename={(name) => renameFolderlessList(si, li, name)}
                onDelete={(space.lists?.length ?? 0) > 1 || space.folders.length > 0 ? () => deleteFolderlessList(si, li) : undefined}
                existsInWorkspace={hasExisting ? flExists : undefined}
              >
                {list.statuses.map((status, sti) => (
                  <StatusRow
                    key={sti}
                    status={status}
                    editable={editable}
                    canDelete={list.statuses.length > 2}
                    onRename={(name) => renameFolderlessStatus(si, li, sti, name)}
                    onDelete={() => deleteFolderlessStatus(si, li, sti)}
                    onChangeType={(type) => changeFolderlessStatusType(si, li, sti, type)}
                  />
                ))}
                {editable && (
                  <button
                    onClick={() => addFolderlessStatus(si, li)}
                    className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Status
                  </button>
                )}
                {list.description && (
                  <p className="text-xs text-text-muted pl-2 pb-1 italic">{list.description}</p>
                )}
              </TreeNode>
              );
            })}
            {/* Add list directly to space */}
            {editable && (
              <button
                onClick={() => addFolderlessList(si)}
                className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <Plus className="w-3 h-3" /> Add List
              </button>
            )}
            {/* Folders and their lists */}
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
                onDelete={() => deleteFolder(si, fi)}
                existsInWorkspace={hasExisting ? fExists : undefined}
              >
                {folder.lists.map((list, li) => {
                  const lExists = listInFolderExists(space.name, folder.name, list.name);
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
                        className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Status
                      </button>
                    )}
                    {list.description && (
                      <p className="text-xs text-text-muted pl-2 pb-1 italic">{list.description}</p>
                    )}
                  </TreeNode>
                  );
                })}
                {/* Add list inside folder */}
                {editable && (
                  <button
                    onClick={() => addList(si, fi)}
                    className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
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
                className="flex items-center gap-1.5 py-1 pl-2 text-xs text-text-muted hover:text-accent transition-colors"
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
            defaultOpen
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

        {/* Recommended Tags */}
        {(plan.recommended_tags?.length || editable) && (
          <TreeNode
            icon={<Tag className="w-4 h-4 text-warning" />}
            label="Recommended Tags"
            badge={`${plan.recommended_tags?.length || 0}`}
            badgeColor="bg-warning/15 text-warning"
            defaultOpen
          >
            <div className="flex flex-wrap gap-1.5 py-1 pl-2">
              {plan.recommended_tags?.map((tag, i) => (
                <EditableChip
                  key={i}
                  label={tag.name}
                  bgColor={tag.tag_bg}

                  editable={editable}
                  onRename={(name) => renameTag(i, name)}
                  onDelete={() => deleteTag(i)}
                />
              ))}
              {editable && (
                <button
                  onClick={addTag}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors px-2 py-1 rounded-md border border-dashed border-border hover:border-accent/40"
                >
                  <Plus className="w-3 h-3" /> Add Tag
                </button>
              )}
            </div>
          </TreeNode>
        )}

        {/* Recommended Docs */}
        {(plan.recommended_docs?.length || editable) && (
          <TreeNode
            icon={<FileText className="w-4 h-4 text-info" />}
            label="Recommended Docs"
            badge={`${plan.recommended_docs?.length || 0}`}
            badgeColor="bg-info/15 text-info"
            defaultOpen
          >
            <div className="space-y-1 py-1 pl-2">
              {plan.recommended_docs?.map((doc, i) => (
                <EditableListItem
                  key={i}
                  label={doc.name}
                  description={doc.description}
                  editable={editable}
                  onRename={(name) => renameDoc(i, name)}
                  onDelete={() => deleteDoc(i)}
                />
              ))}
              {editable && (
                <button
                  onClick={addDoc}
                  className="flex items-center gap-1.5 py-1 text-xs text-text-muted hover:text-accent transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Doc
                </button>
              )}
            </div>
          </TreeNode>
        )}

        {/* Recommended Goals */}
        {(plan.recommended_goals?.length || editable) && (
          <TreeNode
            icon={<Target className={`w-4 h-4 ${goalsUnsupported ? 'text-text-muted' : 'text-success'}`} />}
            label={goalsUnsupported ? `Recommended Goals (requires upgrade)` : 'Recommended Goals'}
            badge={`${plan.recommended_goals?.length || 0}`}
            badgeColor={goalsUnsupported ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}
            defaultOpen
          >
            <div className="space-y-1 py-1 pl-2">
              {plan.recommended_goals?.map((goal, i) => (
                <EditableListItem
                  key={i}
                  label={goal.name}
                  description={goal.description}
                  editable={editable}
                  onRename={(name) => renameGoal(i, name)}
                  onDelete={() => deleteGoal(i)}
                />
              ))}
              {editable && (
                <button
                  onClick={addGoal}
                  className="flex items-center gap-1.5 py-1 text-xs text-text-muted hover:text-accent transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Goal
                </button>
              )}
            </div>
          </TreeNode>
        )}

        {/* AI Reasoning */}
        {plan.reasoning && (
          <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 mt-2">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-accent mb-1">Why this structure?</p>
                <p className="text-sm text-text-secondary leading-relaxed">{plan.reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deletion confirmation dialog */}
      {showDeleteConfirm && hasDeletions && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 mt-2">
          <div className="flex items-start gap-2.5 mb-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning mb-1">Items to remove from ClickUp</p>
              <p className="text-xs text-text-secondary mb-2">
                These items were created by Binee in a previous build but are no longer in the updated structure.
                Would you like to remove them from your ClickUp workspace?
              </p>
            </div>
          </div>
          <div className="space-y-1 mb-3 ml-7">
            {itemsToDelete.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Trash2 className="w-3.5 h-3.5 text-warning/70 flex-shrink-0" />
                <span className="text-text-secondary">
                  {item.parentName ? `${item.parentName} / ` : ''}{item.name}
                </span>
                <span className="text-[11px] font-medium text-text-muted uppercase">{item.type}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-7">
            <button
              onClick={() => { setShowDeleteConfirm(false); onApproveWithDeletions?.(); }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-warning/90 text-white text-xs font-medium rounded-lg
                hover:bg-warning transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove &amp; Build
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); onApproveSkipDeletions?.(); }}
              className="px-4 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg
                hover:bg-surface-hover transition-colors"
            >
              Keep All &amp; Build
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border shrink-0">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg
            hover:border-accent/40 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Revise with AI
        </button>
        <button
          onClick={() => {
            if (hasDeletions) {
              setShowDeleteConfirm(true);
            } else {
              onApprove();
            }
          }}
          className="flex items-center gap-1.5 px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg
            hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
        >
          <Rocket className="w-4 h-4" />
          Approve &amp; Build
        </button>
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
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
            {badge}
          </span>
        )}

        {/* Exists / New indicator */}
        {existsInWorkspace !== undefined && !editing && (
          existsInWorkspace ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-text-muted/10 text-text-muted">
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
    <div className="flex items-center gap-2 py-1 pl-2 text-sm text-text-secondary group/status">
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
          className="flex-1 min-w-0 text-sm text-text-primary bg-surface border border-accent/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <span
          className={`flex-1 min-w-0 truncate ${editable ? 'cursor-text hover:text-accent' : ''}`}
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
          className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-surface text-text-muted border-none outline-none cursor-pointer hover:text-accent appearance-none"
          title="Change status type"
        >
          {STATUS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      ) : (
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-surface text-text-muted">
          {status.type}
        </span>
      )}

      {editable && !editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover/status:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => { setEditValue(status.name); setEditing(true); }}
            className="p-0.5 text-text-muted hover:text-accent transition-colors"
            title="Rename status"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-0.5 text-text-muted hover:text-error transition-colors"
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

// ---------------------------------------------------------------------------
// Editable Chip (for tags)
// ---------------------------------------------------------------------------

function EditableChip({
  label,
  bgColor,
  editable,
  onRename,
  onDelete,
}: {
  label: string;
  bgColor: string;
  editable: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setEditValue(label);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') { setEditValue(label); setEditing(false); }
        }}
        className="text-xs font-medium px-2 py-1 rounded-md bg-surface border border-accent/40 outline-none focus:ring-1 focus:ring-accent text-text-primary w-24"
      />
    );
  }

  return (
    <span
      className="text-xs font-medium px-2 py-1 rounded-md border group/chip inline-flex items-center gap-1"
      style={{ backgroundColor: `${bgColor}20`, color: bgColor, borderColor: `${bgColor}40` }}
    >
      <span
        className={editable ? 'cursor-text' : ''}
        onDoubleClick={() => {
          if (editable) { setEditValue(label); setEditing(true); }
        }}
      >
        {label}
      </span>
      {editable && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5"
          title="Remove tag"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Editable List Item (for docs and goals)
// ---------------------------------------------------------------------------

function EditableListItem({
  label,
  description,
  editable,
  onRename,
  onDelete,
}: {
  label: string;
  description?: string;
  editable: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setEditValue(label);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-2 py-1 group/item">
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
          className="flex-1 min-w-0 text-sm text-text-primary bg-surface border border-accent/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium text-text-primary ${editable ? 'cursor-text hover:text-accent' : ''}`}
            onDoubleClick={() => {
              if (editable) { setEditValue(label); setEditing(true); }
            }}
          >
            {label}
          </span>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
      )}
      {editable && !editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => { setEditValue(label); setEditing(true); }}
            className="p-0.5 text-text-muted hover:text-accent transition-colors"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-0.5 text-text-muted hover:text-error transition-colors"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
