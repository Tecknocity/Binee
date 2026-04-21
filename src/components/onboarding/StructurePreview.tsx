'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Folder,
  List,
  Circle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Check,
  Sparkles,
} from 'lucide-react';
import type { SetupPlan, StatusPlan } from '@/lib/setup/types';
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';
import type { ExecutionItem } from '@/lib/setup/executor';
import { getUnsupportedFeatures, getPlanCapabilities, getPlanLimits } from '@/lib/clickup/plan-capabilities';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ApproveOptions {
  /**
   * When true, after the workspace is created we also generate starter tasks
   * per list and fill in starter content for each doc, using Haiku. Default
   * true. Failures are silent - see src/lib/setup/enrichment-phase.ts.
   */
  generateEnrichment?: boolean;
}

interface StructurePreviewProps {
  plan: SetupPlan;
  onApprove: (opts?: ApproveOptions) => void;
  onEdit: () => void;
  /** Called when the plan is modified in-place (editable mode) */
  onPlanChange?: (plan: SetupPlan) => void;
  /** Current workspace structure from ClickUp (for showing existing vs new) */
  existingStructure?: ExistingWorkspaceStructure | null;
  /** ClickUp plan tier for showing feature limitation warnings */
  planTier?: string;
  /** Items from previous builds that will be removed (not in current plan) */
  itemsToDelete?: ExecutionItem[];
  /** Existing workspace items NOT in the plan (user can choose to delete) */
  existingItemsNotInPlan?: ExecutionItem[];
  /** Whether AI recommendations are still loading */
  isLoadingRecommendations?: boolean;
  /** Approve with user-selected deletions. Receives the checked items. */
  onApproveWithDeletions?: (selectedItems: ExecutionItem[], opts?: ApproveOptions) => void;
  /** Approve but skip deletions (keep old items) */
  onApproveSkipDeletions?: (opts?: ApproveOptions) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StructurePreview({ plan, onApprove, onEdit, onPlanChange, existingStructure, planTier, itemsToDelete, existingItemsNotInPlan, isLoadingRecommendations, onApproveWithDeletions, onApproveSkipDeletions }: StructurePreviewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generateEnrichment, setGenerateEnrichment] = useState(true);
  const hasBineeDeletions = itemsToDelete && itemsToDelete.length > 0;
  const hasExistingExtras = existingItemsNotInPlan && existingItemsNotInPlan.length > 0;

  // Track which items the user has UNCHECKED (all Binee items checked by
  // default, all existing extras UNchecked by default - safe default).
  const [uncheckedItems, setUncheckedItems] = useState<Set<string>>(new Set());
  // Existing workspace items the user explicitly CHECKED for deletion.
  // Pre-populated from AI recommendations when available.
  const [checkedExistingItems, setCheckedExistingItems] = useState<Set<string>>(new Set());

  // Collapsible section state - expanded by default, collapse when > COLLAPSE_THRESHOLD items
  const COLLAPSE_THRESHOLD = 5;
  const [existingExpanded, setExistingExpanded] = useState(true);
  const [bineeExpanded, setBineeExpanded] = useState(true);

  // Select all / deselect all helpers
  const selectAllExisting = useCallback(() => {
    if (!existingItemsNotInPlan) return;
    const all = new Set<string>();
    for (const item of existingItemsNotInPlan) {
      all.add(item.clickupId ?? `${item.type}:${item.name}`);
    }
    setCheckedExistingItems(all);
  }, [existingItemsNotInPlan]);

  const deselectAllExisting = useCallback(() => {
    setCheckedExistingItems(new Set());
  }, []);

  const selectAllBinee = useCallback(() => {
    setUncheckedItems(new Set());
  }, []);

  const deselectAllBinee = useCallback(() => {
    if (!itemsToDelete) return;
    const all = new Set<string>();
    for (const item of itemsToDelete) {
      all.add(item.clickupId ?? `${item.type}:${item.name}`);
    }
    setUncheckedItems(all);
  }, [itemsToDelete]);

  // When the dialog opens, reset Binee unchecks and pre-select existing items
  // based on AI recommendations (items with recommendation === 'delete').
  const handleShowDeleteConfirm = () => {
    setUncheckedItems(new Set());
    // Pre-check items that AI recommends to delete
    const preChecked = new Set<string>();
    if (existingItemsNotInPlan) {
      for (const item of existingItemsNotInPlan) {
        if (item.recommendation === 'delete') {
          const key = item.clickupId ?? `${item.type}:${item.name}`;
          preChecked.add(key);
        }
      }
    }
    setCheckedExistingItems(preChecked);
    setShowDeleteConfirm(true);
  };

  const toggleDeletionItem = (item: ExecutionItem) => {
    const key = item.clickupId ?? `${item.type}:${item.name}`;
    setUncheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleExistingItem = (item: ExecutionItem) => {
    const key = item.clickupId ?? `${item.type}:${item.name}`;
    setCheckedExistingItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isBineeItemChecked = (item: ExecutionItem) => {
    const key = item.clickupId ?? `${item.type}:${item.name}`;
    return !uncheckedItems.has(key);
  };

  const isExistingItemChecked = (item: ExecutionItem) => {
    const key = item.clickupId ?? `${item.type}:${item.name}`;
    return checkedExistingItems.has(key);
  };

  // Combine all items selected for deletion (Binee-built + user-selected existing)
  const selectedDeletionItems = useMemo(() => {
    const bineeSelected = (itemsToDelete ?? []).filter(i => isBineeItemChecked(i));
    const existingSelected = (existingItemsNotInPlan ?? []).filter(i => isExistingItemChecked(i));
    return [...bineeSelected, ...existingSelected];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsToDelete, existingItemsNotInPlan, uncheckedItems, checkedExistingItems]);

  const totalTasksInSelection = useMemo(() => {
    return selectedDeletionItems.reduce((sum, i) => sum + (i.taskCount ?? 0), 0);
  }, [selectedDeletionItems]);

  // Plan limit analysis
  const planLimits = planTier ? getPlanLimits(planTier) : null;
  const existingSpaceCount = existingStructure?.spaces?.length ?? 0;
  const newSpaceCount = plan.spaces.filter(s => {
    const sName = s.name.toLowerCase();
    return !existingStructure?.spaces?.some(es => es.name.toLowerCase() === sName);
  }).length;
  const totalSpacesAfterBuild = existingSpaceCount + newSpaceCount;
  const spaceLimitExceeded = planLimits?.maxSpaces != null && totalSpacesAfterBuild > planLimits.maxSpaces;
  const spaceSlotsNeeded = spaceLimitExceeded ? totalSpacesAfterBuild - (planLimits?.maxSpaces ?? 0) : 0;
  const hasDeletions = hasBineeDeletions || hasExistingExtras;
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

      {/* Space limit warning */}
      {spaceLimitExceeded && (
        <div className="mb-3 shrink-0 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Your {planCaps?.label ?? 'Free'} plan allows {planLimits?.maxSpaces} spaces
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Your workspace has {existingSpaceCount} space{existingSpaceCount !== 1 ? 's' : ''} and
              this plan needs {newSpaceCount} new one{newSpaceCount !== 1 ? 's' : ''}.
              You will need to remove at least {spaceSlotsNeeded} existing space{spaceSlotsNeeded !== 1 ? 's' : ''} before building.
              Click &quot;Approve &amp; Build&quot; to manage your existing items.
            </p>
          </div>
        </div>
      )}

      {/* Existing items notice (no space limit exceeded, but items exist outside the plan) */}
      {!spaceLimitExceeded && hasExistingExtras && (
        <div className="mb-3 shrink-0 bg-accent/5 border border-accent/15 rounded-xl p-3 flex items-start gap-2.5">
          <FolderOpen className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent">
              Your workspace has existing items
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {(() => {
                const spaceCount = existingItemsNotInPlan!.filter(i => i.type === 'space').length;
                const docCount = existingItemsNotInPlan!.filter(i => i.type === 'doc').length;
                const otherCount = existingItemsNotInPlan!.length - spaceCount - docCount;
                const parts: string[] = [];
                if (spaceCount > 0) parts.push(`${spaceCount} space${spaceCount !== 1 ? 's' : ''}`);
                if (docCount > 0) parts.push(`${docCount} doc${docCount !== 1 ? 's' : ''}`);
                if (otherCount > 0) parts.push(`${otherCount} other item${otherCount !== 1 ? 's' : ''}`);
                return parts.length > 0 ? `${parts.join(', ')} in your workspace ${parts.length === 1 && (spaceCount + docCount + otherCount) === 1 ? 'is' : 'are'} not part of this plan. ` : '';
              })()}
              Click &quot;Approve &amp; Build&quot; to review and choose which items to keep or remove.
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

        {/* Manual setup next steps callout */}
        {totalStatuses > 0 && (
          <div className="bg-info/5 border border-info/15 rounded-xl p-4 mt-2">
            <div className="flex items-start gap-2.5">
              <Settings2 className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-info mb-1">Some items will need manual setup</p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Certain elements like statuses, automations, views, and custom fields cannot be created
                  automatically via the API. After the build, you will get a step-by-step checklist to
                  configure them in ClickUp.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Reconciliation / deletion confirmation modal overlay */}
      {showDeleteConfirm && (hasDeletions || spaceLimitExceeded) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-navy-dark border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            {/* Modal header — P2-F: larger title with item count */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Review before building</h3>
                {selectedDeletionItems.length > 0 && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    {selectedDeletionItems.length} item{selectedDeletionItems.length !== 1 ? 's' : ''} selected for removal
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-2 text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
              {/* Plan limit warning */}
              {spaceLimitExceeded && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-500">
                        Space limit will be exceeded
                      </p>
                      <p className="text-xs text-text-primary mt-1">
                        Your workspace has {existingSpaceCount} space{existingSpaceCount !== 1 ? 's' : ''} and
                        the plan wants to create {newSpaceCount} new one{newSpaceCount !== 1 ? 's' : ''}.
                        Your {planCaps?.label ?? 'Free'} plan allows {planLimits?.maxSpaces} spaces.
                        Delete at least {spaceSlotsNeeded} existing space{spaceSlotsNeeded !== 1 ? 's' : ''} below to make room,
                        or edit the plan to use fewer spaces.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Existing workspace items NOT in the plan — P2-D: card background */}
              {hasExistingExtras && (
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <FolderOpen className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">Existing items not in the new plan</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {isLoadingRecommendations
                          ? 'Analyzing your workspace to recommend which items to keep or remove...'
                          : existingItemsNotInPlan!.some(i => i.recommendation)
                            ? 'We analyzed your workspace and pre-selected items to remove. Review and adjust as needed.'
                            : 'Check items you want to remove to free up space. Unchecked items will be kept.'}
                      </p>
                    </div>
                  </div>
                  {isLoadingRecommendations && (
                    <div className="ml-8 mb-3 flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Generating recommendations...
                    </div>
                  )}
                  {/* P3-J: Select all / deselect all */}
                  {!isLoadingRecommendations && existingItemsNotInPlan!.length > 1 && (
                    <div className="flex items-center justify-between ml-8 mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={selectAllExisting}
                          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                        >
                          Select all
                        </button>
                        <span className="text-border">|</span>
                        <button
                          type="button"
                          onClick={deselectAllExisting}
                          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                          Deselect all
                        </button>
                      </div>
                      {/* P3-I: Collapse toggle when many items */}
                      {existingItemsNotInPlan!.length > COLLAPSE_THRESHOLD && (
                        <button
                          type="button"
                          onClick={() => setExistingExpanded(v => !v)}
                          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          {existingExpanded ? (
                            <><ChevronUp className="w-3.5 h-3.5" />Collapse</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5" />Show all {existingItemsNotInPlan!.length}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-1 ml-8">
                    {(existingExpanded
                      ? existingItemsNotInPlan!
                      : existingItemsNotInPlan!.slice(0, COLLAPSE_THRESHOLD)
                    ).map((item, i) => {
                      const isChecked = isExistingItemChecked(item);
                      const hasTasksInside = (item.taskCount ?? 0) > 0;
                      const hasRec = !!item.recommendation;
                      const recIsDelete = item.recommendation === 'delete';
                      return (
                        <label
                          key={`existing-${i}`}
                          className="flex items-start gap-3 cursor-pointer group p-2 -mx-2 rounded-lg hover:bg-surface-hover transition-colors"
                        >
                          {/* P3-H: Custom styled checkbox */}
                          <span
                            className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                              isChecked
                                ? 'bg-red-500 border-red-500'
                                : 'border-border group-hover:border-text-muted'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExistingItem(item)}
                            className="sr-only"
                          />
                          {/* P3-K: Improved row layout */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${isChecked ? 'text-red-400' : 'text-text-primary'}`}>
                                {item.parentName ? `${item.parentName} / ` : ''}{item.name}
                              </span>
                              <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-medium text-text-muted uppercase">{item.type}</span>
                                {!isChecked && (
                                  <span className="text-xs font-semibold text-success px-1.5 py-0.5 bg-success/15 rounded">keep</span>
                                )}
                                {isChecked && (
                                  <span className="text-xs font-semibold text-red-400 px-1.5 py-0.5 bg-red-500/15 rounded">delete</span>
                                )}
                                {hasRec && (
                                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                    recIsDelete ? 'text-warning bg-warning/15' : 'text-info bg-info/15'
                                  }`}>
                                    suggested
                                  </span>
                                )}
                              </span>
                            </div>
                            {item.recommendationReason && (
                              <p className="text-xs text-text-muted mt-1 italic">
                                {item.recommendationReason}
                              </p>
                            )}
                            {hasTasksInside && (
                              <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                Contains {item.taskCount} task{item.taskCount !== 1 ? 's' : ''}
                                {isChecked && <span className="text-red-400 font-medium"> - will be permanently deleted</span>}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                    {/* P3-I: Show collapsed count */}
                    {!existingExpanded && existingItemsNotInPlan!.length > COLLAPSE_THRESHOLD && (
                      <button
                        type="button"
                        onClick={() => setExistingExpanded(true)}
                        className="w-full text-center py-2 text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                      >
                        Show {existingItemsNotInPlan!.length - COLLAPSE_THRESHOLD} more items...
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* P3-L: Section divider between the two sections */}
              {hasExistingExtras && hasBineeDeletions && (
                <div className="border-t border-border" />
              )}

              {/* Section: Binee-created items from previous builds */}
              {hasBineeDeletions && (
                <div className="bg-warning/10 border border-warning/25 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">Items from previous build no longer needed</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        These items were created by Binee in a previous build but are no longer in the updated structure.
                        Uncheck any items you want to keep.
                      </p>
                    </div>
                  </div>
                  {/* Select all / deselect all */}
                  {itemsToDelete!.length > 1 && (
                    <div className="flex items-center justify-between ml-8 mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={selectAllBinee}
                          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                        >
                          Select all
                        </button>
                        <span className="text-border">|</span>
                        <button
                          type="button"
                          onClick={deselectAllBinee}
                          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                          Deselect all
                        </button>
                      </div>
                      {/* Collapse toggle when many items */}
                      {itemsToDelete!.length > COLLAPSE_THRESHOLD && (
                        <button
                          type="button"
                          onClick={() => setBineeExpanded(v => !v)}
                          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          {bineeExpanded ? (
                            <><ChevronUp className="w-3.5 h-3.5" />Collapse</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5" />Show all {itemsToDelete!.length}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-1 ml-8">
                    {(bineeExpanded
                      ? itemsToDelete!
                      : itemsToDelete!.slice(0, COLLAPSE_THRESHOLD)
                    ).map((item, i) => {
                      const isChecked = isBineeItemChecked(item);
                      const hasTasksInside = (item.taskCount ?? 0) > 0;
                      return (
                        <label
                          key={`binee-${i}`}
                          className="flex items-start gap-3 cursor-pointer group p-2 -mx-2 rounded-lg hover:bg-surface-hover transition-colors"
                        >
                          {/* Custom styled checkbox - red when checked, same as first section */}
                          <span
                            className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                              isChecked
                                ? 'bg-red-500 border-red-500'
                                : 'border-border group-hover:border-text-muted'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDeletionItem(item)}
                            className="sr-only"
                          />
                          {/* Row layout - matches first section pattern */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${isChecked ? 'text-red-400' : 'text-text-primary'}`}>
                                {item.parentName ? `${item.parentName} / ` : ''}{item.name}
                              </span>
                              <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-medium text-text-muted uppercase">{item.type}</span>
                                {!isChecked && (
                                  <span className="text-xs font-semibold text-success px-1.5 py-0.5 bg-success/15 rounded">keep</span>
                                )}
                                {isChecked && (
                                  <span className="text-xs font-semibold text-red-400 px-1.5 py-0.5 bg-red-500/15 rounded">delete</span>
                                )}
                              </span>
                            </div>
                            {hasTasksInside && isChecked && (
                              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                Contains {item.taskCount} task{item.taskCount !== 1 ? 's' : ''} - will be permanently deleted
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                    {/* Show collapsed count */}
                    {!bineeExpanded && itemsToDelete!.length > COLLAPSE_THRESHOLD && (
                      <button
                        type="button"
                        onClick={() => setBineeExpanded(true)}
                        className="w-full text-center py-2 text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                      >
                        Show {itemsToDelete!.length - COLLAPSE_THRESHOLD} more items...
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Warning banner when selected items contain tasks */}
              {totalTasksInSelection > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-500">
                        Warning: {totalTasksInSelection} task{totalTasksInSelection !== 1 ? 's' : ''} will be permanently deleted
                      </p>
                      <p className="text-xs text-text-primary mt-1">
                        The selected items contain tasks. Removing these items from ClickUp will delete all tasks inside them.
                        This cannot be undone. Uncheck items you want to keep.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer — P1-B: red destructive button */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onApproveWithDeletions?.(selectedDeletionItems, { generateEnrichment });
                }}
                disabled={selectedDeletionItems.length === 0 && spaceLimitExceeded}
                className={`flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedDeletionItems.length > 0
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-accent hover:bg-accent/90'
                  }`}
              >
                {selectedDeletionItems.length > 0 ? (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove {selectedDeletionItems.length} &amp; Build
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Build
                  </>
                )}
              </button>
              {!spaceLimitExceeded && (
                <button
                  onClick={() => { setShowDeleteConfirm(false); onApproveSkipDeletions?.({ generateEnrichment }); }}
                  className="px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-lg
                    hover:bg-surface-hover transition-colors"
                >
                  Keep All &amp; Build
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2.5 text-sm text-text-muted hover:text-text-secondary transition-colors ml-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border shrink-0">
        <label
          className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none mr-auto"
          title="After your workspace is built, Binee will use AI to add a few starter tasks to each list and fill in your docs with relevant content. Turn off to create an empty workspace."
        >
          <input
            type="checkbox"
            checked={generateEnrichment}
            onChange={(e) => setGenerateEnrichment(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-accent cursor-pointer"
          />
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Add starter tasks and doc content</span>
        </label>
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
            if (hasDeletions || spaceLimitExceeded) {
              handleShowDeleteConfirm();
            } else {
              onApprove({ generateEnrichment });
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
