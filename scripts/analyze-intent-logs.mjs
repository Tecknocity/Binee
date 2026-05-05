#!/usr/bin/env node

// Phase 1 shadow-mode log analysis.
//
// Reads any text file (Vercel logs export, NDJSON, plain text), finds every
// `[setup-intent]` line emitted by setupper-brain.ts, and prints a Phase 1
// monitoring report including a 20-row spot-check sample.
//
// Usage:
//   node scripts/analyze-intent-logs.mjs <path-to-logfile>
//
// Optional second arg sets the spot-check sample size (default 20).

import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const path = argv[2];
const sampleSize = Number.parseInt(argv[3] ?? '20', 10) || 20;

if (!path) {
  console.error('Usage: node scripts/analyze-intent-logs.mjs <path-to-logfile> [sampleSize=20]');
  exit(1);
}

let raw;
try {
  raw = readFileSync(path, 'utf8');
} catch (err) {
  console.error(`Failed to read ${path}: ${err.message}`);
  exit(1);
}

const records = [];
let skipped = 0;

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  // Vercel sometimes wraps lines as NDJSON with the real log inside `message`.
  if (trimmed.startsWith('{')) {
    try {
      const wrapper = JSON.parse(trimmed);
      const inner = typeof wrapper.message === 'string' ? wrapper.message : trimmed;
      const parsed = extractIntent(inner);
      if (parsed) { records.push(parsed); continue; }
    } catch {
      // fall through to plain-text mode
    }
  }

  const parsed = extractIntent(line);
  if (parsed) records.push(parsed);
  else if (line.includes('[setup-intent]')) skipped++;
}

if (records.length === 0) {
  console.log('No [setup-intent] log lines parsed.');
  if (skipped) console.log(`(${skipped} candidate lines failed to parse.)`);
  exit(0);
}

// Tallies
const intentCounts = { discovery: 0, refine: 0, info: 0, other: 0 };
const legacyCounts = { clarifier: 0, reviser: 0, info: 0, other: 0 };
const disagreement = {};
const confBuckets = { high: 0, mid: 0, low: 0 };
let fallbacks = 0;
const latencies = [];
const conversations = new Set();

const classifierToHandler = { discovery: 'clarifier', refine: 'reviser', info: 'info' };

for (const r of records) {
  if (r.intent in intentCounts) intentCounts[r.intent]++; else intentCounts.other++;
  if (r.legacyWouldHavePicked in legacyCounts) legacyCounts[r.legacyWouldHavePicked]++;
  else legacyCounts.other++;

  if (r.fallbackUsed === true) fallbacks++;

  const conf = typeof r.confidence === 'number' ? r.confidence : 0;
  if (conf >= 0.9) confBuckets.high++;
  else if (conf >= 0.6) confBuckets.mid++;
  else confBuckets.low++;

  if (typeof r.modelCallMs === 'number' && r.modelCallMs > 0) {
    latencies.push(r.modelCallMs);
  }

  if (r.conversationId) conversations.add(r.conversationId);

  // Disagreement = classifier wanted a different handler than legacy actually picked.
  // Skipped on fallback or low-confidence rows since the classifier wouldn't have acted there anyway.
  if (!r.fallbackUsed && conf >= 0.6) {
    const wanted = classifierToHandler[r.intent];
    const actual = r.legacyWouldHavePicked;
    if (wanted && actual && wanted !== actual) {
      const key = `${actual} -> ${wanted}`;
      disagreement[key] = (disagreement[key] ?? 0) + 1;
    }
  }
}

const total = records.length;
const pct = (n) => total ? `${((n / total) * 100).toFixed(1)}%` : '0.0%';

const p50 = percentile(latencies, 0.50);
const p95 = percentile(latencies, 0.95);
const p99 = percentile(latencies, 0.99);
const max = latencies.length ? Math.max(...latencies) : 0;

// Report
console.log('=== Phase 1 Shadow-Mode Analysis ===');
console.log(`File:                       ${path}`);
console.log(`Lines parsed:               ${total}`);
console.log(`Distinct conversations:     ${conversations.size}`);
if (skipped) console.log(`Skipped (parse failure):    ${skipped}`);

console.log('\nIntent distribution (what classifier picked)');
for (const [name, n] of Object.entries(intentCounts)) {
  if (name === 'other' && n === 0) continue;
  console.log(`  ${name.padEnd(12)} ${String(n).padStart(4)} (${pct(n)})`);
}

console.log('\nActual routing (what user saw - legacy still in charge in shadow mode)');
for (const [name, n] of Object.entries(legacyCounts)) {
  if (name === 'other' && n === 0) continue;
  console.log(`  ${name.padEnd(12)} ${String(n).padStart(4)} (${pct(n)})`);
}

console.log('\nClassifier vs legacy disagreement (excluding fallbacks and low-confidence)');
const entries = Object.entries(disagreement).sort((a, b) => b[1] - a[1]);
let disagreementTotal = 0;
for (const [k, n] of entries) {
  console.log(`  ${k.padEnd(28)} ${String(n).padStart(4)}`);
  disagreementTotal += n;
}
if (disagreementTotal === 0) console.log('  (none)');
console.log(`  Total                       ${String(disagreementTotal).padStart(4)} (${pct(disagreementTotal)})`);

console.log('\nConfidence');
console.log(`  >= 0.9                      ${String(confBuckets.high).padStart(4)} (${pct(confBuckets.high)})`);
console.log(`  0.6 - 0.9                   ${String(confBuckets.mid).padStart(4)} (${pct(confBuckets.mid)})`);
console.log(`  < 0.6 (legacy used)         ${String(confBuckets.low).padStart(4)} (${pct(confBuckets.low)})`);
console.log(`  fallbackUsed=true           ${String(fallbacks).padStart(4)} (${pct(fallbacks)})`);

console.log('\nLatency (modelCallMs)');
console.log(`  p50:                        ${p50}ms`);
console.log(`  p95:                        ${p95}ms`);
console.log(`  p99:                        ${p99}ms`);
console.log(`  max:                        ${max}ms`);

console.log('\nPass gate (Phase 1 -> Phase 2)');
const fallbackRate = total ? fallbacks / total : 0;
const checks = [
  ['>= 50 turns logged', total >= 50, `${total}/50`],
  ['p50 <= 400ms', p50 <= 400, `${p50}ms`],
  ['p99 <= 1500ms', p99 <= 1500, `${p99}ms`],
  ['fallback rate <= 5%', fallbackRate <= 0.05, pct(fallbacks)],
];
for (const [name, ok, value] of checks) {
  console.log(`  ${ok ? '[x]' : '[ ]'} ${name.padEnd(28)} ${value}`);
}
console.log('  [ ] >= 18/20 spot-check match    (manual)');
console.log('  [ ] no info-on-discovery         (manual)');
console.log('  [ ] no discovery-on-opt-out      (manual)');

// Spot-check sample
console.log(`\n=== Spot-check sample (${Math.min(sampleSize, total)} random) ===`);
console.log('Paste rows below into docs/intent-classifier-phase-1-spotcheck.md and judge each.\n');

const sample = pickSample(records, sampleSize);
const headerCols = ['#', 'Message preview', 'Classifier', 'Legacy', 'Conf', 'Reasoning'];
const rows = [headerCols, headerCols.map(() => '---')];
for (let i = 0; i < sample.length; i++) {
  const r = sample[i];
  const msg = (r.messagePreview || '(no preview - update setupper-brain.ts and redeploy)').replace(/\|/g, '\\|').slice(0, 80);
  const reason = (r.reasoning || '').replace(/\|/g, '\\|').slice(0, 60);
  rows.push([
    String(i + 1),
    msg,
    String(r.intent ?? ''),
    String(r.legacyWouldHavePicked ?? ''),
    typeof r.confidence === 'number' ? r.confidence.toFixed(2) : '',
    reason,
  ]);
}
for (const row of rows) console.log(`| ${row.join(' | ')} |`);

console.log('\nFor each row, fill in your judgment in the spot-check doc:');
console.log('  - "Your call"  = what intent SHOULD this be (discovery/refine/info)?');
console.log('  - "Match?"     = does the classifier pick equal your call? (yes/no)');
console.log('  - violation flags: info-on-discovery, discovery-on-opt-out');

// Helpers

function extractIntent(s) {
  const tag = s.indexOf('[setup-intent]');
  if (tag < 0) return null;
  const start = s.indexOf('{', tag);
  if (start < 0) return null;
  const end = findClosingBrace(s, start);
  if (end < 0) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function findClosingBrace(s, start) {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (inStr) {
      if (c === '\\') escape = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function pickSample(arr, n) {
  if (arr.length <= n) return [...arr];
  const indices = new Set();
  while (indices.size < n) indices.add(Math.floor(Math.random() * arr.length));
  return [...indices].map((i) => arr[i]);
}
