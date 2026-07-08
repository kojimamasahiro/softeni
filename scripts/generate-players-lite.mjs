// scripts/generate-players-lite.mjs
// 結果ページを持たない選手（index.json の count<5）向けの軽量データを生成する。
//
// 目的:
//   count<5 の選手は SEO 観点から個別ページ（/players/{id}/results/）を作らない方針だが、
//   「どの大会に・誰と出たか」だけはユーザーに見せたい。そこで HTML ページではなく、
//   クライアントのモーダルから fetch する軽量 JSON を public/data/players-lite/{id}.json に出力する。
//   固有 URL を持たず JS で表示するだけなので検索エンジンにはインデックスされない（薄いページの量産を回避）。
//
// 出力（チャンク方式）:
//   Cloudflare Pages の 20,000 ファイル制限を回避するため、1 選手 1 ファイルではなく
//   Math.floor(id / CHUNK_SIZE) 単位で chunk-{n}.json にまとめて出力する。
//   public/data/players-lite/chunk-{n}.json:
//   {
//     "2788": {
//       id: "2788",
//       name: "金井一平",
//       tournaments: [
//         { tournamentName, year, team, partner: { name, id, hasPage } | null }
//       ]   // year 降順
//     },
//     ...
//   }
//
// prebuild で実行する（package.json 参照）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 結果ページが実在する閾値（src/pages/players/[id]/results.tsx の getStaticPaths と揃える）
const PAGE_MIN_COUNT = 5;

// チャンクサイズ（src/components/PlayerLiteLink.tsx の LITE_CHUNK_SIZE と揃える）
const CHUNK_SIZE = 50;

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

// 大会ラベル（generate-players-json.mjs と同じく index / local_index を統合）
function loadTournamentLabelMap() {
  const map = new Map();
  for (const name of ['index.json', 'local_index.json']) {
    const arr = readJson(
      path.join(projectRoot, 'data', 'tournaments', name),
      [],
    );
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t && t.tournamentId)
          map.set(t.tournamentId, t.label || t.tournamentId);
      }
    }
  }
  return map;
}

// data/tournaments/details/{tournamentId}/{year}/{category}.json を全列挙
function* iterDetailRecords() {
  const detailsRoot = path.join(projectRoot, 'data', 'tournaments', 'details');
  if (!fs.existsSync(detailsRoot)) return;
  for (const tournamentId of fs.readdirSync(detailsRoot)) {
    const tdir = path.join(detailsRoot, tournamentId);
    if (!fs.statSync(tdir).isDirectory()) continue;
    for (const year of fs.readdirSync(tdir)) {
      const ydir = path.join(tdir, year);
      if (!fs.statSync(ydir).isDirectory()) continue;
      for (const file of fs
        .readdirSync(ydir)
        .filter((f) => f.endsWith('.json'))) {
        const detail = readJson(path.join(ydir, file));
        if (!detail) continue;
        yield {
          tournamentId,
          year,
          category: file.replace(/\.json$/i, ''),
          detail,
        };
      }
    }
  }
}

const nameKey = (last, first) =>
  `${String(last ?? '')}||${String(first ?? '')}`;

function main() {
  const index = readJson(
    path.join(projectRoot, 'data', 'players', 'index.json'),
    [],
  );
  if (!Array.isArray(index) || index.length === 0) {
    console.warn('[players-lite] index.json が空のためスキップ');
    return;
  }

  // 名前 → 最初の id（結果ページ・各種照合で使う「同姓同名は最初の id」規約に合わせる）
  // 名前 → その最初の id の count（結果ページ有無の判定に使う）
  const firstIdByName = new Map();
  const countByName = new Map();
  const countById = new Map();
  for (const p of index) {
    const id = String(p.id);
    const c = p.count ?? 0;
    countById.set(id, c);
    const k = nameKey(p.lastName, p.firstName);
    if (!firstIdByName.has(k)) {
      firstIdByName.set(k, id);
      countByName.set(k, c);
    }
  }

  // 対象 = 最初の id の count<5 の名前（モーダル起動の id はすべてこの集合に入る）
  const targetNames = new Set();
  for (const [k, c] of countByName.entries()) {
    if (c < PAGE_MIN_COUNT) targetNames.add(k);
  }

  const labelMap = loadTournamentLabelMap();

  // 名前 → 出場リスト
  const appearancesByName = new Map();

  for (const rec of iterDetailRecords()) {
    const { tournamentId, year, category, detail } = rec;
    const participants = Array.isArray(detail.participants)
      ? detail.participants
      : [];
    if (participants.length === 0) continue;
    const participantById = new Map();
    for (const p of participants) participantById.set(p.id, p);

    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    for (const e of entries) {
      if (!Array.isArray(e.playerIds)) continue;
      for (const pid of e.playerIds) {
        const self = participantById.get(pid);
        if (!self) continue;
        const k = nameKey(self.lastName, self.firstName);
        if (!targetNames.has(k)) continue;

        // ペア（自分以外の playerIds）
        let partner = null;
        const others = e.playerIds.filter((x) => x !== pid);
        if (others.length > 0) {
          const op = participantById.get(others[0]);
          if (op) {
            const pName = `${op.lastName ?? ''}${op.firstName ?? ''}`.trim();
            const pk = nameKey(op.lastName, op.firstName);
            const pid2 = firstIdByName.get(pk) ?? null;
            const hasPage = pid2
              ? (countById.get(pid2) ?? 0) >= PAGE_MIN_COUNT
              : false;
            partner = pName ? { name: pName, id: pid2, hasPage } : null;
          }
        }

        if (!appearancesByName.has(k)) appearancesByName.set(k, []);
        appearancesByName.get(k).push({
          dedupKey: `${tournamentId}/${year}/${category}`,
          tournamentName: labelMap.get(tournamentId) || tournamentId,
          year: Number(year) || year,
          gameCategory: category.split('-')[0] || null,
          team:
            self.team && String(self.team).trim().length > 0
              ? String(self.team).trim()
              : null,
          partner,
        });
      }
    }
  }

  // 出力（チャンク単位に集約）
  const outDir = path.join(projectRoot, 'public', 'data', 'players-lite');
  // 古い出力を掃除する（旧 {id}.json 形式の孤児ファイルや、対象から外れた
  // チャンクを残さないため可能なら全消去する）。一部環境で unlink が
  // EPERM になっても致命的ではない（孤児ファイルは未使用なだけ）ので握りつぶす。
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    // ignore: フォルダ削除不可な環境では上書きで継続する
  }
  fs.mkdirSync(outDir, { recursive: true });

  // chunkIndex → { id: playerLite }
  const chunks = new Map();
  let written = 0;
  for (const k of targetNames) {
    const id = firstIdByName.get(k);
    if (!id) continue;
    const raw = appearancesByName.get(k) ?? [];
    // 同一大会・カテゴリの重複を除去
    const seen = new Set();
    const tournaments = [];
    for (const a of raw) {
      if (seen.has(a.dedupKey)) continue;
      seen.add(a.dedupKey);
      tournaments.push({
        tournamentName: a.tournamentName,
        year: a.year,
        gameCategory: a.gameCategory,
        team: a.team,
        partner: a.partner,
      });
    }
    tournaments.sort((a, b) => Number(b.year) - Number(a.year));

    const [last, first] = k.split('||');
    const chunkIndex = Math.floor(Number(id) / CHUNK_SIZE);
    if (!chunks.has(chunkIndex)) chunks.set(chunkIndex, {});
    chunks.get(chunkIndex)[id] = {
      id,
      name: `${last}${first}`,
      tournaments,
    };
    written++;
  }

  for (const [chunkIndex, players] of chunks.entries()) {
    fs.writeFileSync(
      path.join(outDir, `chunk-${chunkIndex}.json`),
      JSON.stringify(players),
    );
  }

  console.log(
    `[players-lite] ${written} 選手を ${chunks.size} チャンクに出力（count<${PAGE_MIN_COUNT} の選手、CHUNK_SIZE=${CHUNK_SIZE}）→ public/data/players-lite/`,
  );
}

main();
