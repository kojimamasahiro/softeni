// scripts/playerStats/verify-golden-final.ts
// P7 最終検証: 代表選手（fixtures）＋ランダム抽出選手で
//   1) _facts キャッシュ = ソースからの再計算（増分キャッシュが stale でないこと）
//   2) 集計の内部不変量（時系列順・勝敗の整合・placement の妥当性）
// を突合する。curated の既存実値との byte 一致は verify-analysis-migration が担う。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/verify-golden-final.ts [--sample=50]

import fs from 'fs';
import path from 'path';

import { aggregateCareer } from '../../lib/playerStats/aggregators/career';
import { buildFacts } from '../../lib/playerStats/facts';
import { ALL_FIXTURES } from '../../lib/playerStats/fixtures';
import { loadIdentity } from '../../lib/playerStats/identity';
import { buildReverseIndex, readReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';
import type { PlayerFacts } from '../../lib/playerStats/types';

function log(msg: string): void {
  console.log(`[verify-golden-final] ${msg}`);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 内部不変量チェック。違反メッセージの配列を返す（空 = OK）。 */
function checkInvariants(facts: PlayerFacts): string[] {
  const errors: string[] = [];

  // 時系列昇順（date → roundOrder）
  for (let i = 1; i < facts.matches.length; i += 1) {
    const a = facts.matches[i - 1];
    const b = facts.matches[i];
    if (a.date > b.date || (a.date === b.date && a.roundOrder > b.roundOrder)) {
      errors.push(`matches not chronological at index ${i}`);
      break;
    }
  }

  // 勝敗の整合: career.overall = countsForWinRate かつ win/lose の畳み込み
  let wins = 0;
  let losses = 0;
  for (const m of facts.matches) {
    if (!m.countsForWinRate) continue;
    if (m.result === 'win') wins += 1;
    else if (m.result === 'lose') losses += 1;
  }
  const career = aggregateCareer(facts);
  if (career.overall.matches.total !== wins + losses || career.overall.matches.wins !== wins || career.overall.matches.losses !== losses) {
    errors.push(`career totals mismatch: agg ${career.overall.matches.wins}-${career.overall.matches.losses} vs naive ${wins}-${losses}`);
  }
  // 種目別合計 = 総計
  let discTotal = 0;
  for (const d of Object.values(career.byDiscipline)) discTotal += d.matches.total;
  if (discTotal !== career.overall.matches.total) {
    errors.push(`byDiscipline sum ${discTotal} != overall ${career.overall.matches.total}`);
  }

  // entries の妥当性
  for (const e of facts.entries) {
    if (e.category === 'team') {
      errors.push(`team entry leaked into facts (${e.tournamentId}/${e.year})`);
      break;
    }
    if (e.isKnockoutSinglesDoublesMixed && !['singles', 'doubles', 'mixed'].includes(e.category)) {
      errors.push(`isKnockoutSDM set on category=${e.category}`);
      break;
    }
    if (e.reachedFinal && !e.reachedSemifinal) {
      errors.push(`reachedFinal without reachedSemifinal (${e.tournamentId}/${e.year})`);
      break;
    }
  }
  return errors;
}

function main(): void {
  const root = process.cwd();
  let sampleN = 50;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--sample=')) sampleN = Number(a.slice('--sample='.length)) || sampleN;
  }

  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const reverseIndex = readReverseIndex(root) ?? buildReverseIndex(adapter, identity);

  // 代表選手 + ランダム抽出（seed 固定・決定的）
  const targets = new Set<number>(ALL_FIXTURES.map((f) => f.id));
  const allIds = Object.keys(reverseIndex).map((k) => Number(k));
  const rand = mulberry32(20260702);
  const shuffled = [...allIds].sort(() => rand() - 0.5);
  for (const id of shuffled) {
    if (targets.size >= ALL_FIXTURES.length + sampleN) break;
    targets.add(id);
  }

  let ok = 0;
  let cacheMismatch = 0;
  let invariantFail = 0;
  let noCache = 0;

  for (const id of targets) {
    const fresh = buildFacts(id, adapter, identity, reverseIndex);

    // 1) キャッシュ突合（_facts はビルド成果物。生成済みなら再計算と一致すべき）
    const cachePath = path.join(root, 'data', 'players', '_facts', `${id}.json`);
    if (fs.existsSync(cachePath)) {
      const cachedText = fs.readFileSync(cachePath, 'utf-8');
      const freshText = JSON.stringify(fresh);
      if (cachedText !== freshText) {
        cacheMismatch += 1;
        log(`  ✗ player ${id} (${fresh.displayName}): _facts cache differs from recompute (stale incremental?)`);
        continue;
      }
    } else if (fresh.matches.length > 0 || fresh.entries.length > 0) {
      noCache += 1;
      log(`  ! player ${id}: no _facts cache (run generate-facts first)`);
    }

    // 2) 不変量
    const errors = checkInvariants(fresh);
    if (errors.length > 0) {
      invariantFail += 1;
      log(`  ✗ player ${id} (${fresh.displayName}): ${errors.join(' / ')}`);
      continue;
    }
    ok += 1;
  }

  log(
    `checked ${targets.size} players (fixtures ${ALL_FIXTURES.length} + random ${targets.size - ALL_FIXTURES.length}): ok=${ok} cacheMismatch=${cacheMismatch} invariantFail=${invariantFail} noCache=${noCache}`,
  );
  if (cacheMismatch > 0 || invariantFail > 0) process.exitCode = 1;
}

main();
