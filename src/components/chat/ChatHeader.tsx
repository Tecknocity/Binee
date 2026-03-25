'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface ChatHeaderProps {
  title: string;
  onRename: (newTitle: string) => void;
}

export default function ChatHeader({ title, onRename }: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editValue, title, onRename]);

  const handleCancel = useCallback(() => {
    setEditValue(title);
    setIsEditing(false);
  }, [title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  return (
    <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-border/50 bg-navy-base/80 backdrop-blur-sm">
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            maxLength={100}
            className="flex-1 min-w-0 bg-surface border border-accent/40 rounded-lg px-3 py-1 text-sm font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSave}
            className="p-1 rounded text-accent hover:bg-accent/10 transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancel}
            className="p-1 rounded text-text-muted hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="group flex items-center gap-2 min-w-0 hover:bg-surface-hover/50 rounded-lg px-2 py-1 -mx-2 transition-colors"
          title="Click to rename"
        >
          <span className="text-sm font-medium text-text-primary truncate">
            {title}
          </span>
          <Pencil className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      )}
    </div>
  );
}
