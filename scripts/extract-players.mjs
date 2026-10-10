import fs from 'fs/promises';
import path from 'path';

// node scripts/extract-players.mjs <最小出場数>
//
// data/players/index.json の count（結果ページ /players/{id}/results/ が実在するのは count>=5）を、
// 今の大会データで数え直す。既存の行と id は保ち、最小出場数以上の新規氏名だけを末尾に採番する。
// **引数を渡す**こと（結果ページの閾値と同じ 5）。引数なしは 1 になり、出場1回の氏名まで採番する。
// prebuild では流れないので、取り込みを重ねると count は古くなる。流したら node scripts/check-name-splits.mjs --strict。
// 姓名の切り位置を直したときは normalize-name-splits.mjs が該当氏名の count だけ数え直す。

const BASE_DIR = path.join(process.cwd(), 'data', 'tournaments', 'details');
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

  // count occurrences of each player across files
  const counts = new Map();
  for (const f of files) {
    try {
      const txt = await fs.readFile(f, 'utf8');
      const json = JSON.parse(txt);
      if (Array.isArray(json.participants)) {
        for (const p of json.participants) {
          const ln = (p.lastName || '').trim();
          const fn = (p.firstName || '').trim();
          // 姓・名の両方が揃っていない参加者（PDF由来で名が復元できない等）は
          // 新規プレイヤーとして採番しない。旧仕様（ln || fn）は片方欠けでも
          // 採番してしまい、参照されない「幽霊選手」を index.json に残していた
          // （docs/raw/2026-07-19-manual-fix-checklist.md 7-1 参照）。
          if (ln && fn) {
            const k = keyOf(ln, fn);
            counts.set(k, (counts.get(k) || 0) + 1);
          }
        }
      }
    } catch (e) {
      console.warn('skip', f, e.message);
    }
  }
  // parse threshold from CLI arg: minimum occurrences required to include a player
  const arg = parseInt(process.argv[2], 10);
  const minOccur = Number.isInteger(arg) && arg > 0 ? arg : 1;

  // load existing players (to preserve ids when possible)
  const existing = await readExistingPlayers(OUT_PATH);
  const existingMap = new Map();
  let maxId = 0;
  for (const p of existing) {
    const idNum = Number.isInteger(p.id) && p.id > 0 ? p.id : parseInt(p.id, 10) > 0 ? parseInt(p.id, 10) : 0;
    if (idNum > maxId) maxId = idNum;
    const k = keyOf(p.lastName, p.firstName);
    if (!existingMap.has(k)) existingMap.set(k, p);
  }

  // build list of keys that meet threshold, sorted deterministically
  const keptKeys = Array.from(counts.keys())
    .filter((k) => counts.get(k) >= minOccur)
    .sort((a, b) => {
      const [la, fa] = a.split('\t');
      const [lb, fb] = b.split('\t');
      if (la === lb) return fa.localeCompare(fb, 'ja');
      return la.localeCompare(lb, 'ja');
    });

  // Ensure existing entries have valid ids (assign if missing) and start output with them
  let assignedToExisting = 0;
  for (const p of existing) {
    const valid = Number.isInteger(p.id) && p.id > 0;
    if (!valid) {
      maxId += 1;
      p.id = maxId;
      assignedToExisting += 1;
    }
  }

  const out = existing.slice(); // preserve all existing players
  let totalAdded = 0;

  // Append new players that meet the threshold but are not present in existing list
  for (const k of keptKeys) {
    if (existingMap.has(k)) continue; // already present
    const [lastName, firstName] = k.split('\t');
    maxId += 1;
    const newP = { id: maxId, lastName, firstName };
    out.push(newP);
    existingMap.set(k, newP);
    totalAdded += 1;
  }

  // Add count to all output players
  for (const p of out) {
    const k = keyOf(p.lastName, p.firstName);
    p.count = counts.get(k) || 0;
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  // write as array with each element on a single line: [{ ... }, { ... }]
  // 1行の形は、リポジトリにコミットされている index.json（`{ "id": 1, "lastName": "安藤", ... }`）に合わせる。
  // 詰めた形（`{"id":1,...}`）で書くと、count を数え直すたびに全行が差分になる。
  const lines = [];
  lines.push('[');
  for (let i = 0; i < out.length; i++) {
    const obj = out[i];
    const body = Object.entries(obj)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(', ');
    const comma = i === out.length - 1 ? '' : ',';
    lines.push(`  { ${body} }${comma}`);
  }
  lines.push(']');
  await fs.writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(
    `wrote ${out.length} players -> ${OUT_PATH} (preserved ${existing.length} existing, assigned ${assignedToExisting} ids to existing, appended ${totalAdded} new players)`,
  );
}

main();
