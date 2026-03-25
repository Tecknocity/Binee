'use client';

import React from 'react';
import Image from 'next/image';
import type { ChatMessage, DashboardChoiceData } from '@/hooks/useChat';
import ToolCallIndicator from './ToolCallIndicator';
import ActionConfirmation from './ActionConfirmation';
import DashboardChoiceButtons from './DashboardChoiceButtons';
import CreditBadge from './MessageCreditBadge';

interface AssistantMessageProps {
  message: ChatMessage;
  onConfirmAction?: (id: string) => void;
  onCancelAction?: (id: string) => void;
  onAlwaysAllowAction?: (id: string, toolName: string) => void;
  onDashboardChoice?: (messageId: string, choice: DashboardChoiceData) => void;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Markdown renderer — handles bold, italic, lists, code blocks, headings, tables
// ---------------------------------------------------------------------------

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={`code-${i}`}
          className="bg-navy-dark/60 rounded-lg px-3 py-2 my-2 text-xs font-mono text-text-secondary overflow-x-auto"
        >
          {lang && (
            <div className="text-xs text-text-muted mb-1 select-none">{lang}</div>
          )}
          {codeLines.join('\n')}
        </pre>,
      );
      continue;
    }

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s-|]+\|$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headerCells = tableLines[0]
        .split('|')
        .filter((c) => c.trim())
        .map((c) => c.trim());
      const bodyRows = tableLines.slice(2); // skip header + separator
      elements.push(
        <div key={`table-${i}`} className="my-2 overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                {headerCells.map((cell, ci) => (
                  <th
                    key={ci}
                    className="text-left px-3 py-1.5 border-b border-border text-text-muted font-medium"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => {
                const cells = row
                  .split('|')
                  .filter((c) => c.trim())
                  .map((c) => c.trim());
                return (
                  <tr key={ri}>
                    {cells.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 border-b border-border/50 text-text-secondary"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(
        <p key={`h3-${i}`} className="text-sm font-semibold text-text-primary mt-3 mb-1" role="heading" aria-level={4}>
          {renderInline(line.slice(4))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <p key={`h2-${i}`} className="text-sm font-bold text-text-primary mt-3 mb-1" role="heading" aria-level={3}>
          {renderInline(line.slice(3))}
        </p>,
      );
      i++;
      continue;
    }

    // Unordered list item
    if (line.match(/^[-*] /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listItems.push(
          <li key={`li-${i}`} className="text-text-secondary">
            {renderInline(lines[i].replace(/^[-*] /, ''))}
          </li>,
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside my-1 space-y-0.5 text-sm">
          {listItems}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        listItems.push(
          <li key={`oli-${i}`} className="text-text-secondary">
            {renderInline(lines[i].replace(/^\d+\. /, ''))}
          </li>,
        );
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside my-1 space-y-0.5 text-sm">
          {listItems}
        </ol>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-sm text-text-secondary leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <>{elements}</>;
}

// Inline formatting: bold, italic, code
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-text-primary">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          className="bg-navy-dark/60 px-1.5 py-0.5 rounded text-xs font-mono text-accent-light"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssistantMessage({
  message,
  onConfirmAction,
  onCancelAction,
  onAlwaysAllowAction,
  onDashboardChoice,
}: AssistantMessageProps) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Binee avatar */}
      <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
        <Image src="/Binee__icon__white.svg" alt="Binee" width={24} height={24} unoptimized />
      </div>

      <div className="max-w-[80%] space-y-1 min-w-0">
        {/* Tool calls */}
        {message.toolCalls?.map((tc) => (
          <ToolCallIndicator key={tc.id} toolCall={tc} />
        ))}

        {/* Message content with markdown */}
        <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-bl-md">
          {renderMarkdown(message.content)}
        </div>

        {/* Dashboard choice buttons */}
        {message.dashboardChoices && message.dashboardChoices.length > 0 && (
          <DashboardChoiceButtons
            choices={message.dashboardChoices}
            selected={message.selectedDashboardChoice}
            onSelect={(choice) => onDashboardChoice?.(message.id, choice)}
          />
        )}

        {/* Action confirmation */}
        {message.actionConfirmation && onConfirmAction && onCancelAction && (
          <ActionConfirmation
            data={message.actionConfirmation}
            onConfirm={onConfirmAction}
            onCancel={onCancelAction}
            onAlwaysAllow={onAlwaysAllowAction}
          />
        )}

        {/* Footer: timestamp + credits */}
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs text-text-muted">
            {formatTimestamp(message.timestamp)}
          </p>
          <CreditBadge creditsConsumed={message.creditsConsumed} />
        </div>
      </div>
    </div>
  );
}
