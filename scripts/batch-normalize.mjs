#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// コマンド node scripts/batch-normalize.mjs "data/tournaments/*/{\$1}/{\$2}/results" "data/tournament/details/{\$1}/{\$2}"
function usage() {
  console.error(
    'Usage: node scripts/batch-normalize.mjs <srcPattern> <outTemplate>\n' +
      'Example: node scripts/batch-normalize.mjs "data/tournaments/*/{$1}/{$2}/results" "data/tournament/details/{$1}/{$2}"',
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length < 2) usage();

const srcPattern = argv[0];
const outTemplate = argv[1];

// Build a regex for matching directories and capture values for placeholders {$n}.
function patternToRegexAndPlaceholders(pat) {
  const parts = pat.split('/');
  const segs = [];
  const placeholderOrder = [];
  for (const seg of parts) {
    if (seg === '*') {
      segs.push('(?:[^/]+)');
    } else {
      const m = seg.match(/^\{\$([0-9]+)\}$/);
      if (m) {
        // capture group for placeholder
        segs.push('([^/]+)');
        placeholderOrder.push(Number(m[1]));
      } else {
        // escape regex metacharacters in this literal segment
        segs.push(seg.replace(/([.+?^=!:${}()|\[\]\/\\])/g, '\\$1'));
      }
    }
  }
  const regex = new RegExp('^' + segs.join('/') + '$');
  return { regex, placeholderOrder };
}

const { regex: srcRegex } = patternToRegexAndPlaceholders(srcPattern);

// Find matching directories under cwd
function findMatchingDirs(root) {
  const matches = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        const rel = path.relative(process.cwd(), full);
        // normalize to posix-style separators for matching
        const relPosix = rel.split(path.sep).join('/');
        const m = relPosix.match(srcRegex);
        if (m) matches.push({ dir: full, captures: m.slice(1) });
        walk(full);
      }
    }
  }
  walk(root);
  return matches;
}

function buildOutDirFromTemplate(template, captures) {
  return template.replace(/\{\$([0-9]+)\}/g, (_, n) => {
    const idx = Number(n) - 1;
    return captures[idx] || '';
  });
}

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'normalize-to-participants-entries.cjs',
);
if (!fs.existsSync(script)) {
  console.error('Normalizer script not found at', script);
  process.exit(3);
}

// Find all directories matching pattern
const matches = findMatchingDirs(process.cwd());
if (!matches.length) {
  console.error('No directories matched pattern:', srcPattern);
  process.exit(2);
}

const failures = [];
for (const m of matches) {
  const { dir, captures } = m;
  // compute output dir for this matched directory
  const outDirTemplate = buildOutDirFromTemplate(outTemplate, captures);
  const outDirResolved = path.resolve(process.cwd(), outDirTemplate);
  fs.mkdirSync(outDirResolved, { recursive: true });

  // walk files inside this matched dir and process .json files
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.json')) continue;
    // filename filter
    if (!(e.name.startsWith('doubles') || e.name.startsWith('singles')))
      continue;
    const filePath = path.join(dir, e.name);
    const outPath = path.join(outDirResolved, e.name);
    console.log('Processing', filePath, '->', outPath);
    try {
      execFileSync('node', [script, filePath, outPath], { stdio: 'inherit' });
    } catch (err) {
      console.error('Failed to process', filePath, err && err.message);
      failures.push({ file: filePath, err });
    }
  }
}

if (failures.length) {
  console.error('Completed with failures:', failures.length);
  process.exit(4);
}

console.log('All files processed successfully.');
