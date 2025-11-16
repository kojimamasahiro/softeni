import fs from 'fs/promises';
import path from 'path';

// node scripts/extract-players.mjs

const BASE_DIR = path.join(process.cwd(), 'data', 'tournament', 'details');
const OUT_PATH = path.join(process.cwd(), 'data', 'players', 'index.json');

async function findJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await findJsonFiles(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

function keyOf(lastName, firstName) {
  return `${(lastName || '').trim()}\t${(firstName || '').trim()}`;
}

async function readExistingPlayers(outPath) {
  try {
    const txt = await fs.readFile(outPath, 'utf8');
    const json = JSON.parse(txt);
    if (Array.isArray(json)) return json;
    return [];
  } catch {
    // file doesn't exist or invalid -> start empty
    return [];
  }
}

async function main() {
  const files = await findJsonFiles(BASE_DIR).catch((err) => {
    console.error(err);
    process.exit(1);
  });

  const foundSet = new Set();
  for (const f of files) {
    try {
      const txt = await fs.readFile(f, 'utf8');
      const json = JSON.parse(txt);
      if (Array.isArray(json.participants)) {
        for (const p of json.participants) {
          const ln = (p.lastName || '').trim();
          const fn = (p.firstName || '').trim();
          if (ln || fn) foundSet.add(keyOf(ln, fn));
        }
      }
    } catch (e) {
      console.warn('skip', f, e.message);
    }
  }

  // load existing players
  const existing = await readExistingPlayers(OUT_PATH);
  const map = new Map();
  let maxId = 0;
  // build map of existing players and find max id
  for (const p of existing) {
    const idNum =
      Number.isInteger(p.id) && p.id > 0
        ? p.id
        : parseInt(p.id, 10) > 0
          ? parseInt(p.id, 10)
          : 0;
    if (idNum > maxId) maxId = idNum;
    const k = keyOf(p.lastName, p.firstName);
    if (!map.has(k)) map.set(k, idNum);
  }

  // assign ids to existing entries that lack a valid id
  let assignedToExisting = 0;
  for (const p of existing) {
    const valid = Number.isInteger(p.id) && p.id > 0;
    if (!valid) {
      maxId += 1;
      p.id = maxId;
      assignedToExisting += 1;
    }
  }

  // derive players found from files, sorted for deterministic ordering
  const newPlayersKeys = Array.from(foundSet).sort((a, b) => {
    const [la, fa] = a.split('\t');
    const [lb, fb] = b.split('\t');
    if (la === lb) return fa.localeCompare(fb, 'ja');
    return la.localeCompare(lb, 'ja');
  });

  const additions = [];
  for (const k of newPlayersKeys) {
    if (map.has(k)) continue; // already present
    const [lastName, firstName] = k.split('\t');
    maxId += 1;
    const newP = { id: maxId, lastName, firstName };
    additions.push(newP);
    map.set(k, maxId);
  }

  const out = existing.concat(additions);
  const totalAdded = additions.length;
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  // write as array with each element on a single line: [{...}, {...}]
  const lines = [];
  lines.push('[');
  for (let i = 0; i < out.length; i++) {
    const obj = out[i];
    // compact object: no spaces after commas to mimic requested style but keep a space after colon for readability
    const compact = JSON.stringify(obj);
    const comma = i === out.length - 1 ? '' : ',';
    lines.push(`  ${compact}${comma}`);
  }
  lines.push(']');
  await fs.writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(
    `wrote ${out.length} players -> ${OUT_PATH} (assigned ${assignedToExisting} ids to existing, appended ${totalAdded} new players)`,
  );
}

main();
