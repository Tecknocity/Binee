// src/lib/file-parser.ts
// Client-side file parsing for CSV, XLSX, and text files

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedFile {
  name: string;
  type: 'csv' | 'xlsx' | 'text' | 'json';
  /** Human-readable text representation of file content */
  content: string;
  /** Number of data rows (for tabular files) */
  rowCount?: number;
  /** Column headers (for tabular files) */
  columns?: string[];
  /** Whether the content was truncated */
  truncated: boolean;
}

export interface FileAttachment {
  name: string;
  type: ParsedFile['type'];
  content: string;
  rowCount?: number;
  columns?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max content size to send to AI (chars). Keeps within token budget. */
const MAX_CONTENT_CHARS = 15_000;

/** Max rows to include from tabular files */
const MAX_ROWS = 200;

/** Supported MIME types and extensions */
const SUPPORTED_EXTENSIONS = new Set([
  'csv', 'xlsx', 'xls', 'txt', 'md', 'json', 'tsv',
]);

const SUPPORTED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'text/markdown',
  'text/tab-separated-values',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

/** Max file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isFileSupported(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTENSIONS.has(ext) || SUPPORTED_MIME_TYPES.has(file.type);
}

export function getFileError(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" is too large (max 5MB)`;
  }
  if (!isFileSupported(file)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return `File type ".${ext}" is not supported. Use CSV, XLSX, TXT, MD, or JSON.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || ext === 'tsv' || file.type === 'text/csv' || file.type === 'text/tab-separated-values') {
    return parseCsv(file);
  }

  if (ext === 'xlsx' || ext === 'xls' || file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parseXlsx(file);
  }

  if (ext === 'json' || file.type === 'application/json') {
    return parseJson(file);
  }

  // Default: plain text (txt, md, etc.)
  return parseText(file);
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const columns = result.meta.fields || [];
  const rows = result.data as Record<string, string>[];
  const truncated = rows.length > MAX_ROWS;
  const displayRows = rows.slice(0, MAX_ROWS);

  let content = `File: ${file.name} (${rows.length} rows, ${columns.length} columns)\n`;
  content += `Columns: ${columns.join(', ')}\n\n`;

  // Format as a readable table
  for (const row of displayRows) {
    const parts = columns.map(col => `${col}: ${row[col] ?? ''}`);
    content += parts.join(' | ') + '\n';
  }

  if (truncated) {
    content += `\n... (${rows.length - MAX_ROWS} more rows not shown)`;
  }

  // Truncate total content if too long
  const finalTruncated = truncated || content.length > MAX_CONTENT_CHARS;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS) + '\n... (content truncated)';
  }

  return {
    name: file.name,
    type: 'csv',
    content,
    rowCount: rows.length,
    columns,
    truncated: finalTruncated,
  };
}

// ---------------------------------------------------------------------------
// XLSX parser
// ---------------------------------------------------------------------------

async function parseXlsx(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  let content = `File: ${file.name} (${workbook.SheetNames.length} sheet${workbook.SheetNames.length > 1 ? 's' : ''})\n\n`;
  let totalRows = 0;
  const allColumns: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    if (jsonData.length === 0) continue;

    const columns = Object.keys(jsonData[0]);
    allColumns.push(...columns.filter(c => !allColumns.includes(c)));

    const truncated = jsonData.length > MAX_ROWS;
    const displayRows = jsonData.slice(0, MAX_ROWS);
    totalRows += jsonData.length;

    if (workbook.SheetNames.length > 1) {
      content += `--- Sheet: ${sheetName} (${jsonData.length} rows) ---\n`;
    }
    content += `Columns: ${columns.join(', ')}\n\n`;

    for (const row of displayRows) {
      const parts = columns.map(col => `${col}: ${row[col] ?? ''}`);
      content += parts.join(' | ') + '\n';
    }

    if (truncated) {
      content += `\n... (${jsonData.length - MAX_ROWS} more rows not shown)\n`;
    }
    content += '\n';
  }

  const finalTruncated = content.length > MAX_CONTENT_CHARS;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS) + '\n... (content truncated)';
  }

  return {
    name: file.name,
    type: 'xlsx',
    content,
    rowCount: totalRows,
    columns: allColumns,
    truncated: finalTruncated,
  };
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

async function parseJson(file: File): Promise<ParsedFile> {
  const text = await file.text();

  let content = `File: ${file.name}\n\n`;
  try {
    const parsed = JSON.parse(text);
    const pretty = JSON.stringify(parsed, null, 2);
    content += pretty;
  } catch {
    content += text;
  }

  const truncated = content.length > MAX_CONTENT_CHARS;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS) + '\n... (content truncated)';
  }

  return {
    name: file.name,
    type: 'json',
    content,
    truncated,
  };
}

// ---------------------------------------------------------------------------
// Text parser (txt, md)
// ---------------------------------------------------------------------------

async function parseText(file: File): Promise<ParsedFile> {
  const text = await file.text();

  let content = `File: ${file.name}\n\n${text}`;

  const truncated = content.length > MAX_CONTENT_CHARS;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS) + '\n... (content truncated)';
  }

  return {
    name: file.name,
    type: 'text',
    content,
    truncated,
  };
}

// ---------------------------------------------------------------------------
// Format attachments for AI context
// ---------------------------------------------------------------------------

export function formatAttachmentsForAI(attachments: FileAttachment[]): string {
  if (attachments.length === 0) return '';

  const parts = attachments.map((att, i) => {
    const header = attachments.length > 1 ? `[Attachment ${i + 1}: ${att.name}]` : `[Attached file: ${att.name}]`;
    const meta = att.rowCount
      ? ` (${att.rowCount} rows, columns: ${att.columns?.join(', ') ?? 'unknown'})`
      : '';
    return `${header}${meta}\n${att.content}`;
  });

  return parts.join('\n\n---\n\n');
}
