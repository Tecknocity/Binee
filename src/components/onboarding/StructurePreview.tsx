'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Folder,
  List,
  Circle,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Rocket,
  Lightbulb,
  Puzzle,
} from 'lucide-react';
import type { SetupPlan as TypedSetupPlan } from '@/lib/setup/types';
import type { SetupPlan as LegacySetupPlan } from '@/lib/setup/session';

type AnySetupPlan = TypedSetupPlan | LegacySetupPlan;

interface StructurePreviewProps {
  plan: AnySetupPlan;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}

function isTypedPlan(plan: AnySetupPlan): plan is TypedSetupPlan {
  return 'recommended_clickapps' in plan;
}

export function StructurePreview({ plan, onApprove, onEdit, onReject }: StructurePreviewProps) {
  const typed = isTypedPlan(plan);

  // Count totals for summary
  let totalFolders = 0;
  let totalLists = 0;
  let totalItems = 0;
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      totalFolders++;
      for (const list of folder.lists) {
        totalLists++;
        totalItems += typed
          ? (list as TypedSetupPlan['spaces'][0]['folders'][0]['lists'][0]).statuses.length
          : (list as LegacySetupPlan['spaces'][0]['folders'][0]['lists'][0]).tasks.length;
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6">
      {/* Header */}
      <div className="py-4">
        <h2 className="text-xl font-semibold text-text-primary">Proposed Workspace Structure</h2>
        <p className="text-sm text-text-secondary mt-1">
          {plan.spaces.length} {plan.spaces.length === 1 ? 'space' : 'spaces'} &middot;{' '}
          {totalFolders} {totalFolders === 1 ? 'folder' : 'folders'} &middot;{' '}
          {totalLists} {totalLists === 1 ? 'list' : 'lists'} &middot;{' '}
          {totalItems} {typed ? 'statuses' : 'tasks'}
        </p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-4">
        {plan.spaces.map((space, si) => (
          <TreeNode
            key={si}
            icon={<FolderOpen className="w-4 h-4 text-accent" />}
            label={space.name}
            badge="Space"
            badgeColor="bg-accent/15 text-accent"
            defaultOpen
          >
            {space.folders.map((folder, fi) => (
              <TreeNode
                key={fi}
                icon={<Folder className="w-4 h-4 text-warning" />}
                label={folder.name}
                badge="Folder"
                badgeColor="bg-warning/15 text-warning"
              >
                {folder.lists.map((list, li) => {
                  if (typed) {
                    const typedList = list as TypedSetupPlan['spaces'][0]['folders'][0]['lists'][0];
                    return (
                      <TreeNode
                        key={li}
                        icon={<List className="w-4 h-4 text-info" />}
                        label={typedList.name}
                        badge={`${typedList.statuses.length} statuses`}
                        badgeColor="bg-info/15 text-info"
                      >
                        {typedList.statuses.map((status, sti) => (
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
                        {typedList.description && (
                          <p className="text-xs text-text-muted pl-2 pb-1 italic">{typedList.description}</p>
                        )}
                      </TreeNode>
                    );
                  }

                  const legacyList = list as LegacySetupPlan['spaces'][0]['folders'][0]['lists'][0];
                  return (
                    <TreeNode
                      key={li}
                      icon={<List className="w-4 h-4 text-info" />}
                      label={legacyList.name}
                      badge={`${legacyList.tasks.length} tasks`}
                      badgeColor="bg-info/15 text-info"
                    >
                      {legacyList.tasks.map((task, ti) => (
                        <div
                          key={ti}
                          className="flex items-center gap-2 py-1 pl-2 text-sm text-text-secondary"
                        >
                          <Circle className="w-3 h-3 flex-shrink-0 text-text-muted" />
                          <span>{task.name}</span>
                        </div>
                      ))}
                    </TreeNode>
                  );
                })}
              </TreeNode>
            ))}
          </TreeNode>
        ))}

        {/* Recommended ClickApps — only in typed plans */}
        {typed && (plan as TypedSetupPlan).recommended_clickapps.length > 0 && (
          <TreeNode
            icon={<Puzzle className="w-4 h-4 text-success" />}
            label="Recommended ClickApps"
            badge={`${(plan as TypedSetupPlan).recommended_clickapps.length}`}
            badgeColor="bg-success/15 text-success"
          >
            <div className="flex flex-wrap gap-1.5 py-1 pl-2">
              {(plan as TypedSetupPlan).recommended_clickapps.map((app, i) => (
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

        {/* AI Reasoning — only in typed plans */}
        {typed && (plan as TypedSetupPlan).reasoning && (
          <div className="bg-accent/5 border border-accent/15 rounded-xl p-3 mt-2">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-accent mb-1">Why this structure?</p>
                <p className="text-xs text-text-secondary leading-relaxed">{(plan as TypedSetupPlan).reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-muted hover:text-error transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg
              hover:border-accent/40 hover:text-text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
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
// Tree Node
// ---------------------------------------------------------------------------

function TreeNode({
  icon,
  label,
  badge,
  badgeColor,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg
          hover:bg-surface-hover transition-colors group ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
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
        {icon}
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {badge && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </button>
      {open && hasChildren && <div className="ml-6 border-l border-border/50 pl-2">{children}</div>}
    </div>
  );
}
