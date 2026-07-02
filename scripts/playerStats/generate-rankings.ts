// scripts/playerStats/generate-rankings.ts
// 全選手 Facts → 年度×種目のシーズンポイント → data/rankings/{year}-{discipline}.json（順位表）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-rankings.ts
//   [--full] 全年度を強制再生成  [--years=2024,2025] 対象年度を手動指定（manifest 更新なし）
//
// P7 増分: 既定は manifest.lastRun（generate-facts が記録）に従う。
//   シーズンポイントは年度独立（設計 §6.3）なので changedYears のみ再生成。
//   無変更なら何も書かない。順位表の行が変わった選手 id は lastRun.rankingAffectedPlayers
//   として manifest に書き足し、generate-public-json の増分対象に伝える。
// Elo（config.ranking.rating.enabled=false）は今回未実行。

import fs from 'fs';
import path from 'path';

import { RankingFile } from '../../lib/playerStats/aggregators/ranking';
import { computeSeasonPoints } from '../../lib/playerStats/aggregators/rankingCompute';
import { loadRankingConfig } from '../../lib/playerStats/config';
import { playerKey } from '../../lib/playerStats/identity';
import { readManifest, updateLastRun } from '../../lib/playerStats/manifest';
import type { PlayerFacts } from '../../lib/playerStats/types';

const FACTS_DIR = ['data', 'players', '_facts'];
const RANKINGS_DIR = ['data', 'rankings'];

function parseArgs(): { years: Set<number> | null; full: boolean } {
  let years: Set<number> | null = null;
  let full = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--years=')) {
      years = new Set(
        arg
          .slice('--years='.length)
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n)),
      );
    } else if (arg === '--full') {
      full = true;
    }
  }
  return { years, full };
}

function log(msg: string): void {
  console.log(`[generate-rankings] ${msg}`);
}

interface Row {
  playerId: number;
  playerKey: string;
  playerName: string;
  points: number;
}

/** 順位表 2 枚の差分選手（rank / points が変わった・現れた・消えた id）。 */
function diffBoardPlayers(oldFile: RankingFile | null, newFile: RankingFile | null): Set<number> {
  const affected = new Set<number>();
  const oldBy = new Map<number, string>();
  for (const e of oldFile?.entries ?? []) {
    if (typeof e.playerId === 'number') oldBy.set(e.playerId, `${e.rank}:${e.points}`);
  }
  const newBy = new Map<number, string>();
  for (const e of newFile?.entries ?? []) {
    if (typeof e.playerId === 'number') newBy.set(e.playerId, `${e.rank}:${e.points}`);
  }
  for (const [id, v] of newBy) {
    if (oldBy.get(id) !== v) affected.add(id);
  }
  for (const id of oldBy.keys()) {
    if (!newBy.has(id)) affected.add(id);
  }
  return affected;
}

function readRankingFile(filePath: string): RankingFile | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RankingFile;
  } catch {
    return null;
  }
}

function main(): void {
  const root = process.cwd();
  const { years: manualYears, full } = parseArgs();
  const config = loadRankingConfig(root);
  const factsDir = path.join(root, ...FACTS_DIR);
  if (!fs.existsSync(factsDir)) {
    console.error('[generate-rankings] _facts が無い。先に generate-facts を実行。');
    process.exit(1);
  }

  // ---- 対象年度の決定（増分は manifest.lastRun 由来） ----
  const manifest = readManifest(root);
  const manifestDriven = !manualYears; // --years 手動時は manifest を更新しない
  let years: Set<number> | null = manualYears;
  let allYears = full;
  if (!manualYears && !full) {
    const lastRun = manifest?.lastRun;
    if (!lastRun || lastRun.mode === 'full' || lastRun.configChanged) {
      allYears = true;
    } else if (lastRun.changedYears.length === 0) {
      log('no changes (skipped)');
      updateLastRun(root, { rankingAffectedPlayers: [] });
      return;
    } else {
      years = new Set(lastRun.changedYears);
    }
  }
  if (allYears) years = null; // null = 全年度

  // (year, discipline) → 順位表行
  const boards = new Map<string, Row[]>();

  const files = fs.readdirSync(factsDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let facts: PlayerFacts;
    try {
      facts = JSON.parse(fs.readFileSync(path.join(factsDir, file), 'utf-8'));
    } catch {
      continue;
    }
    // #2: 年度別の順位表には「その年度の所属」を刻む（現所属で過去年度を汚染しない）。
    // (year, discipline) ごとに、その季の entries から最頻の selfTeam を採る。
    const teamBySeason = new Map<string, string | null>();
    const teamCounts = new Map<string, Map<string, number>>();
    for (const e of facts.entries) {
      if (!e.selfTeam) continue;
      const k = `${e.year}\t${e.category}`;
      const cm = teamCounts.get(k) ?? new Map<string, number>();
      cm.set(e.selfTeam, (cm.get(e.selfTeam) ?? 0) + 1);
      teamCounts.set(k, cm);
    }
    for (const [k, cm] of teamCounts) {
      let best: string | null = null;
      let bestN = 0;
      for (const [team, n] of cm) {
        if (n > bestN) {
          bestN = n;
          best = team;
        }
      }
      teamBySeason.set(k, best);
    }

    const seasons = computeSeasonPoints(facts.entries, config);
    for (const s of seasons) {
      if (years && !years.has(s.year)) continue;
      if (s.points <= 0) continue;
      const key = `${s.year}\t${s.discipline}`;
      const seasonTeam = teamBySeason.get(key) ?? facts.currentTeam;
      const arr = boards.get(key) ?? [];
      arr.push({
        playerId: facts.playerId,
        playerKey: playerKey(facts.displayName, seasonTeam),
        playerName: facts.displayName,
        points: s.points,
      });
      boards.set(key, arr);
    }
  }

  const outDir = path.join(root, ...RANKINGS_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  const rankingAffected = new Set<number>();
  let written = 0;
  for (const [key, rows] of boards) {
    // 表示順は points 降順（同点は playerId 昇順で決定的に）。
    rows.sort((a, b) => b.points - a.points || a.playerId - b.playerId);
    const [yearStr, discipline] = key.split('\t');
    // #3: 標準競技順位（1224 方式）。同ポイントは同順位、次は件数分飛ばす。
    let prevPoints: number | null = null;
    let prevRank = 0;
    const out: RankingFile = {
      year: Number(yearStr),
      discipline,
      outOf: rows.length,
      entries: rows.map((r, i) => {
        const rank = prevPoints !== null && r.points === prevPoints ? prevRank : i + 1;
        prevPoints = r.points;
        prevRank = rank;
        return {
          rank,
          playerId: r.playerId,
          playerKey: r.playerKey,
          playerName: r.playerName,
          points: r.points,
        };
      }),
    };
    const outPath = path.join(outDir, `${yearStr}-${discipline}.json`);
    const oldFile = readRankingFile(outPath);
    for (const id of diffBoardPlayers(oldFile, out)) rankingAffected.add(id);
    fs.writeFileSync(outPath, JSON.stringify(out), 'utf-8');
    written += 1;
  }

  // 対象年度なのに今回 board が立たなかった順位表は stale として削除
  // （その年度の掲載選手はすべて affected）。
  for (const file of fs.readdirSync(outDir)) {
    const m = /^(\d{4})-(.+)\.json$/.exec(file);
    if (!m) continue;
    const y = Number(m[1]);
    if (years && !years.has(y)) continue;
    if (boards.has(`${y}\t${m[2]}`)) continue;
    const stalePath = path.join(outDir, file);
    for (const id of diffBoardPlayers(readRankingFile(stalePath), null)) {
      rankingAffected.add(id);
    }
    fs.unlinkSync(stalePath);
    log(`pruned stale leaderboard ${file}`);
  }

  if (manifestDriven) {
    // 全年度再生成時（full / configChanged）は public-json 側も全件対象になるため
    // 差分リストは持たない（manifest の肥大防止）。
    updateLastRun(root, {
      rankingAffectedPlayers: allYears ? [] : [...rankingAffected].sort((a, b) => a - b),
    });
  }
  log(`wrote ${written} leaderboards${years ? ` (years: ${[...years].join(',')})` : ' (all years)'} | affected players: ${rankingAffected.size}`);
}

main();
