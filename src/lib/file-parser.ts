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

export interface ImageAttachment {
  name: string;
  type: 'image';
  /** Base64-encoded image data (no data: prefix) */
  base64: string;
  /** MIME type */
  media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** File size in bytes */
  size: number;
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

/** Image extensions and MIME types */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const IMAGE_MIME_MAP: Record<string, ImageAttachment['media_type']> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

/** Extension to MIME fallback for when File.type is empty */
const EXT_TO_IMAGE_MIME: Record<string, ImageAttachment['media_type']> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Max file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Max image size: 5MB (Claude vision limit is 20MB but we keep it reasonable) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isFileSupported(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTENSIONS.has(ext) || SUPPORTED_MIME_TYPES.has(file.type);
}

export function isImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_TYPES.has(file.type);
}

export function isAnySupportedFile(file: File): boolean {
  return isFileSupported(file) || isImageFile(file);
}

export function getFileError(file: File): string | null {
  if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return `Image "${file.name}" is too large (max 5MB)`;
    }
    return null;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" is too large (max 5MB)`;
  }
  if (!isFileSupported(file)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return `File type ".${ext}" is not supported. Use CSV, XLSX, TXT, MD, JSON, PNG, JPG, GIF, or WebP.`;
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
// Image parser — returns base64 for Claude vision API
// ---------------------------------------------------------------------------

export async function parseImage(file: File): Promise<ImageAttachment> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const media_type = IMAGE_MIME_MAP[file.type] || EXT_TO_IMAGE_MIME[ext] || 'image/png';

  return {
    name: file.name,
    type: 'image',
    base64,
    media_type,
    size: file.size,
  };
}

// ---------------------------------------------------------------------------
// Create an ImageAttachment from a clipboard blob (paste events)
// ---------------------------------------------------------------------------

export async function parseImageBlob(blob: Blob, name?: string): Promise<ImageAttachment> {
  const file = new File([blob], name || `screenshot-${Date.now()}.png`, { type: blob.type });
  return parseImage(file);
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
