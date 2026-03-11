'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Folder,
  List,
  CheckSquare,
  FileText,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  MessageSquare,
  Rocket,
} from 'lucide-react';
import type { SetupPlan } from '@/lib/setup/session';

interface StructurePreviewProps {
  plan: SetupPlan;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => void;
  onStartOver: () => void;
}

export function StructurePreview({ plan, onApprove, onRequestChanges, onStartOver }: StructurePreviewProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSubmitFeedback = () => {
    if (feedback.trim()) {
      onRequestChanges(feedback.trim());
      setFeedback('');
      setShowFeedback(false);
    }
  };

  // Count totals for summary
  let totalFolders = 0;
  let totalLists = 0;
  let totalTasks = 0;
  for (const space of plan.spaces) {
    for (const folder of space.folders) {
      totalFolders++;
      for (const list of folder.lists) {
        totalLists++;
        totalTasks += list.tasks.length;
      }
    }
    for (const list of space.folderlessLists) {
      totalLists++;
      totalTasks += list.tasks.length;
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6">
      {/* Header */}
      <div className="py-4">
        <h2 className="text-xl font-semibold text-text-primary">Proposed Workspace Structure</h2>
        <p className="text-sm text-text-secondary mt-1">
          {plan.spaces.length} spaces &middot; {totalFolders} folders &middot; {totalLists} lists &middot;{' '}
          {totalTasks} tasks &middot; {plan.docs.length} docs
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
                icon={<Folder className="w-4 h-4 text-yellow-400" />}
                label={folder.name}
                badge="Folder"
                badgeColor="bg-yellow-400/15 text-yellow-400"
              >
                {folder.lists.map((list, li) => (
                  <TreeNode
                    key={li}
                    icon={<List className="w-4 h-4 text-blue-400" />}
                    label={list.name}
                    badge={`${list.tasks.length} tasks`}
                    badgeColor="bg-blue-400/15 text-blue-400"
                  >
                    {list.tasks.map((task, ti) => (
                      <div key={ti} className="flex items-center gap-2 py-1 pl-2 text-sm text-text-secondary">
                        <CheckSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span>{task.name}</span>
                      </div>
                    ))}
                  </TreeNode>
                ))}
              </TreeNode>
            ))}

            {space.folderlessLists.map((list, li) => (
              <TreeNode
                key={`fl-${li}`}
                icon={<List className="w-4 h-4 text-blue-400" />}
                label={list.name}
                badge={`${list.tasks.length} tasks`}
                badgeColor="bg-blue-400/15 text-blue-400"
              >
                {list.tasks.map((task, ti) => (
                  <div key={ti} className="flex items-center gap-2 py-1 pl-2 text-sm text-text-secondary">
                    <CheckSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span>{task.name}</span>
                  </div>
                ))}
              </TreeNode>
            ))}
          </TreeNode>
        ))}

        {/* Docs */}
        {plan.docs.length > 0 && (
          <TreeNode
            icon={<FileText className="w-4 h-4 text-emerald-400" />}
            label="Documents"
            badge={`${plan.docs.length} docs`}
            badgeColor="bg-emerald-400/15 text-emerald-400"
            defaultOpen
          >
            {plan.docs.map((doc, di) => (
              <div key={di} className="flex items-start gap-2 py-1.5 pl-2">
                <FileText className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm text-text-secondary">{doc.name}</span>
                  {doc.content && (
                    <p className="text-xs text-text-muted mt-0.5">{doc.content}</p>
                  )}
                </div>
              </div>
            ))}
          </TreeNode>
        )}
      </div>

      {/* Feedback input */}
      {showFeedback && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-3">
          <p className="text-sm text-text-secondary mb-2">What would you like to change?</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., Add a space for HR, remove the Sales Pipeline folder..."
            rows={3}
            className="w-full bg-navy-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary
              placeholder:text-text-muted outline-none focus:border-accent/40 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowFeedback(false)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedback.trim()}
              className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg
                hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={onStartOver}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Start Over
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg
              hover:border-accent/40 hover:text-text-primary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Request Changes
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
          hover:bg-white/[0.03] transition-colors group ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
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
