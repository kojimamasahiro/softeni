import fs from 'fs/promises';
import path from 'path';

// node scripts/generate-players-index-from-info.mjs

const PLAYERS_DIR = path.join(process.cwd(), 'data', 'players');
const OUT_PATH = path.join(PLAYERS_DIR, 'index.json');

async function findInfoFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await findInfoFiles(full)));
    } else if (e.isFile() && e.name === 'information.json') {
      files.push(full);
    }
  }
  return files;
}

async function readExisting(outPath) {
  try {
    const txt = await fs.readFile(outPath, 'utf8');
    const json = JSON.parse(txt);
    if (Array.isArray(json)) return json;
    return [];
  } catch {
    return [];
  }
}

function keyOf(lastName, firstName) {
  return `${(lastName || '').trim()}\t${(firstName || '').trim()}`;
}

async function main() {
  const files = await findInfoFiles(PLAYERS_DIR).catch((err) => {
    console.error(err);
    process.exit(1);
  });

  const existing = await readExisting(OUT_PATH);
  const existingMap = new Map();
  let maxId = 0;
  for (const p of existing) {
    const idNum =
      Number.isInteger(p.id) && p.id > 0
        ? p.id
        : parseInt(p.id, 10) > 0
          ? parseInt(p.id, 10)
          : 0;
    if (idNum > maxId) maxId = idNum;
    existingMap.set(keyOf(p.lastName, p.firstName), p);
  }

  const collected = [];
  for (const f of files) {
    try {
      const txt = await fs.readFile(f, 'utf8');
      const json = JSON.parse(txt);
      // prefer fields id, lastName, firstName if present; else try name parsing
      const lastName = json.lastName || json.familyName || json.name || '';
      const firstName = json.firstName || json.givenName || '';
      const id = Number.isInteger(json.id)
        ? json.id
        : json.id
          ? parseInt(json.id, 10)
          : undefined;
      collected.push({
        id,
        lastName: (lastName || '').toString().trim(),
        firstName: (firstName || '').toString().trim(),
      });
    } catch (e) {
      console.warn('skip', f, e.message);
    }
  }

  // dedupe by name, preserving existing id when present
  const out = [];
  const seen = new Set();
  for (const p of collected) {
    const k = keyOf(p.lastName, p.firstName);
    if (seen.has(k)) continue;
    seen.add(k);
    if (existingMap.has(k)) {
      const ep = existingMap.get(k);
      const valid = Number.isInteger(ep.id) && ep.id > 0;
      if (!valid) {
        maxId += 1;
        ep.id = maxId;
      }
      out.push({ id: ep.id, lastName: ep.lastName, firstName: ep.firstName });
    } else {
      let id = p.id;
      if (!Number.isInteger(id) || id <= 0) {
        maxId += 1;
        id = maxId;
      }
      out.push({ id, lastName: p.lastName, firstName: p.firstName });
    }
  }

  // sort deterministically by lastName,firstName
  out.sort((a, b) => {
    if (a.lastName === b.lastName)
      return a.firstName.localeCompare(b.firstName, 'ja');
    return a.lastName.localeCompare(b.lastName, 'ja');
  });

  // write one-line-per-object array
  const lines = [];
  lines.push('[');
  for (let i = 0; i < out.length; i++) {
    const compact = JSON.stringify(out[i]);
    const comma = i === out.length - 1 ? '' : ',';
    lines.push(`  ${compact}${comma}`);
  }
  lines.push(']');
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`wrote ${out.length} players -> ${OUT_PATH}`);
}

main();
