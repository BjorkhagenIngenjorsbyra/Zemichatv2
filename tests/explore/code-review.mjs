/**
 * Fable 5 code review — runs claude-fable-5 over the codebase in batches and
 * collects optimization / improvement findings (perf, correctness risk,
 * redundancy, security, simplification). Companion to ai-explorer.mjs (which
 * drives the UI); this one reads the source.
 *
 * Run (subscription auth — no API key, Fable free through 2026-06-22):
 *   node tests/explore/code-review.mjs
 * Output: tests/explore/runs/code-review-<ts>.md  (+ .json findings)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'node:child_process';

const MODEL = process.env.REVIEW_MODEL || 'claude-fable-5';
const ROOT = path.resolve('src');
const OUT_DIR = path.resolve('tests/explore/runs');
const BATCH_BYTES = Number(process.env.REVIEW_BATCH_BYTES || 38000);
const EXCLUDE = /\.(test|spec)\.|\/tests\/|__mocks__/;

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !EXCLUDE.test(full.replace(/\\/g, '/'))) out.push(full);
  }
  return out;
}

// Group files into batches under BATCH_BYTES so each claude call stays focused.
function batchFiles(files) {
  const batches = [];
  let cur = [];
  let size = 0;
  for (const f of files) {
    const bytes = fs.statSync(f).size;
    if (size + bytes > BATCH_BYTES && cur.length) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += bytes;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

function claude(prompt) {
  const cmd = `claude -p --model ${MODEL} --output-format json --max-turns 1`;
  const raw = execSync(cmd, { input: prompt, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 240000 });
  const parsed = JSON.parse(raw);
  if (parsed.is_error) throw new Error(parsed.result || 'claude error');
  return parsed.result;
}

function extractJsonArray(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const a = body.indexOf('[');
  const b = body.lastIndexOf(']');
  if (a === -1 || b === -1) return [];
  try { return JSON.parse(body.slice(a, b + 1)); } catch { return []; }
}

const SYSTEM =
  'You are a senior staff engineer reviewing a React + Ionic + Capacitor + Supabase (TypeScript) codebase ' +
  'for a family chat app. For the files below, find concrete OPTIMIZATION and IMPROVEMENT opportunities: ' +
  'performance (re-renders, N+1 queries, unbounded fetches, missing indexes/pagination), correctness risks, ' +
  'redundant/duplicated logic that could be shared, oversized components that should be split, missing error ' +
  'handling, security/RLS gaps, and simplifications. Be specific and actionable. Ignore pure style/formatting. ' +
  'Return ONLY a JSON array (no prose) of objects: ' +
  '{"file": string, "area": "perf"|"correctness"|"security"|"redundancy"|"simplify"|"a11y"|"other", ' +
  '"severity": "low"|"medium"|"high", "finding": string, "suggestion": string}. Empty array if nothing notable.';

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = process.env.REVIEW_TS || 'manual';
  const files = walk(ROOT).sort();
  const batches = batchFiles(files);
  console.log(`Files: ${files.length} | Batches: ${batches.length} | model ${MODEL}`);

  const all = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const blob = batch
      .map((f) => `\n===== FILE: ${path.relative(process.cwd(), f).replace(/\\/g, '/')} =====\n` + fs.readFileSync(f, 'utf-8'))
      .join('\n');
    const prompt = `${SYSTEM}\n\nFILES (batch ${i + 1}/${batches.length}):\n${blob}`;
    try {
      const findings = extractJsonArray(claude(prompt));
      findings.forEach((x) => all.push(x));
      console.log(`  batch ${i + 1}/${batches.length}: ${findings.length} findings (${batch.length} files)`);
    } catch (e) {
      console.log(`  batch ${i + 1}/${batches.length}: ERROR ${String(e.message).slice(0, 120)}`);
    }
  }

  // Write JSON + grouped markdown
  const jsonPath = path.join(OUT_DIR, `code-review-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2));

  const order = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  const bySev = (s) => all.filter((x) => x.severity === s);
  const fmt = (x) => `- **[${x.area}] ${x.file}** — ${x.finding}\n  - *Förslag:* ${x.suggestion}`;
  const md =
    `# ZemiChat — Fable 5 kodgenomlysning\n\n` +
    `Modell ${MODEL} · ${files.length} filer · ${batches.length} batchar · ${all.length} fynd\n\n---\n\n` +
    `## Hög allvarsgrad (${bySev('high').length})\n\n${bySev('high').map(fmt).join('\n') || '(inga)'}\n\n` +
    `## Medel (${bySev('medium').length})\n\n${bySev('medium').map(fmt).join('\n') || '(inga)'}\n\n` +
    `## Låg (${bySev('low').length})\n\n${bySev('low').map(fmt).join('\n') || '(inga)'}\n`;
  const mdPath = path.join(OUT_DIR, `code-review-${ts}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`\nReport: ${mdPath}\nJSON: ${jsonPath}\nTotal findings: ${all.length}`);
}

main().catch((e) => { console.error('code-review failed:', e); process.exit(1); });
