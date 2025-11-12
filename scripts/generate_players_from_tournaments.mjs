import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Filter definitions (place your filters here) ----------
// Edit these to change which files are scanned and the default threshold.
const FILTERS = {
  // only process files whose basename starts with one of these prefixes
  filePrefixes: ['doubles', 'singles'],
  // default minimum occurrence when --min-occurrence is not provided
  defaultMinOccurrence: 1,
};
// -----------------------------------------------------------------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function walkDir(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, cb);
    else cb(full);
  }
}

const detailsRoot = path.join(__dirname, '..', 'data', 'tournament', 'details');
const playersFile = path.join(
  __dirname,
  '..',
  'data',
  'players',
  'players.json',
);

// CLI args
const argv = process.argv.slice(2);
let minOccurrence = FILTERS.defaultMinOccurrence;
let dryRun = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--min-occurrence' && argv[i + 1]) {
    minOccurrence = parseInt(argv[i + 1], 10) || 1;
    i++;
  } else if (a === '--dry-run') {
    dryRun = true;
  }
}

let players = [];
if (fs.existsSync(playersFile)) {
  const j = readJson(playersFile);
  if (Array.isArray(j)) players = j;
}

const existsByName = new Map();
let maxId = 0;
for (const p of players) {
  if (p && p.lastName != null && p.firstName != null) {
    existsByName.set(`${p.lastName}||${p.firstName}`, true);
  }
  if (p && typeof p.id === 'number' && Number.isFinite(p.id)) {
    maxId = Math.max(maxId, p.id);
  }
}

let added = 0;

// First pass: count occurrences across all details
const occurrence = new Map();
walkDir(detailsRoot, (file) => {
  if (!file.endsWith('.json')) return;
  const base = path.basename(file);
  if (!FILTERS.filePrefixes.some((p) => base.startsWith(p))) return;
  const j = readJson(file);
  if (!j || !Array.isArray(j.participants)) return;
  for (const part of j.participants) {
    const lastName = part.lastName || '';
    const firstName = part.firstName || '';
    if (!lastName && !firstName) continue;
    const key = `${lastName}||${firstName}`;
    occurrence.set(key, (occurrence.get(key) || 0) + 1);
  }
});

// Second pass: add players that meet the threshold and don't already exist
const toAdd = [];
walkDir(detailsRoot, (file) => {
  if (!file.endsWith('.json')) return;
  const base = path.basename(file);
  if (!FILTERS.filePrefixes.some((p) => base.startsWith(p))) return;
  const j = readJson(file);
  if (!j || !Array.isArray(j.participants)) return;
  for (const part of j.participants) {
    const lastName = part.lastName || '';
    const firstName = part.firstName || '';
    if (!lastName && !firstName) continue;
    const key = `${lastName}||${firstName}`;
    if (existsByName.has(key)) continue; // already in players.json
    const cnt = occurrence.get(key) || 0;
    if (cnt < minOccurrence) continue;
    if (!toAdd.includes(key)) toAdd.push(key);
  }
});

for (const key of toAdd) {
  const [lastName, firstName] = key.split('||');
  maxId += 1;
  const newP = { id: maxId, lastName, firstName };
  players.push(newP);
  existsByName.set(key, true);
  added += 1;
}

if (dryRun) {
  console.log(
    'dry-run: would add ' +
      added +
      ' player(s) (minOccurrence=' +
      minOccurrence +
      ').',
  );
  process.exit(0);
}

// NOTE: previously we refused to write when minOccurrence < 2 unless --force was provided.
// The user asked to allow the default (minOccurrence=1) to run without --force, so that
// safety guard was removed. Use --min-occurrence to restrict additions if desired.

if (!fs.existsSync(detailsRoot)) {
  console.error('details root not found:', detailsRoot);
  process.exit(1);
}

const playersDir = path.dirname(playersFile);
if (!fs.existsSync(playersDir)) fs.mkdirSync(playersDir, { recursive: true });

// Write as an array where each object is on a single line for easier diffs/processing
{
  const out = ['['];
  for (let i = 0; i < players.length; i++) {
    const line = JSON.stringify(players[i]);
    const comma = i === players.length - 1 ? '' : ',';
    out.push(`  ${line}${comma}`);
  }
  out.push(']');
  fs.writeFileSync(playersFile, out.join('\n') + '\n', 'utf8');
}

console.log(`done. added ${added} player(s). total ${players.length}`);
