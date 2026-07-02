// scripts/playerStats/verify-performance.ts
// P7 受け入れ基準: フルビルドが総試合数に線形・1 選手 O(m log m) を実測で確認し、
// 時間予算内であることを CI ログに残す。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/verify-performance.ts [--sample=200]
//
// 時間予算（2026-07 実測: 索引 ~0.1s / 1選手最大 ~21ms / フル外挿 ~29s @ SSD。
// CI・開発機の I/O 差を見込み大きめに設定。恒常的に超えたら設計を疑う）:
//   - 逆引き索引フル構築（details 全走査）: BUDGET_INDEX_MS
//   - 1 選手 buildFacts（最多出場クラス）: BUDGET_PLAYER_MS
//   - 全選手フルビルド（サンプル外挿）: BUDGET_FULL_MS
// 線形性: 選手ごとの ms/match が出場数によらず概ね一定（外れは I/O 粒度による）
//   → 「上位出場選手の ms/match ≤ 全体中央値 × LINEARITY_FACTOR」で判定する。

import { performance } from 'perf_hooks';

import { buildFacts } from '../../lib/playerStats/facts';
import { ALL_FIXTURES } from '../../lib/playerStats/fixtures';
import { loadIdentity } from '../../lib/playerStats/identity';
import { buildReverseIndex, readReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';

const BUDGET_INDEX_MS = 10_000; // 逆引きフル構築
const BUDGET_PLAYER_MS = 500; // 1 選手（最多出場クラスの単発計測。I/O 揺れ込み）
const BUDGET_FULL_MS = 240_000; // 全選手フルビルド外挿（4 分）
const LINEARITY_FACTOR = 12; // ms/match の許容倍率（少試合選手は固定 I/O 支配のため大きめ）

function log(msg: string): void {
  console.log(`[verify-performance] ${msg}`);
}

/** 決定的な擬似乱数（mulberry32）。 */
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

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function main(): void {
  const root = process.cwd();
  let sampleN = 200;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--sample=')) sampleN = Number(a.slice('--sample='.length)) || sampleN;
  }

  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  let failed = 0;

  // ---- 1. 逆引き索引フル構築（O(M) 全走査） ----
  const t0 = performance.now();
  const freshIndex = buildReverseIndex(adapter, identity);
  const indexMs = performance.now() - t0;
  const nPlayers = Object.keys(freshIndex).length;
  const okIndex = indexMs <= BUDGET_INDEX_MS;
  log(`reverse index: ${indexMs.toFixed(0)}ms for ${nPlayers} players ${okIndex ? '✓' : `✗ (budget ${BUDGET_INDEX_MS}ms)`}`);
  if (!okIndex) failed += 1;

  const reverseIndex = readReverseIndex(root) ?? freshIndex;

  // ---- 2. 代表選手（最多出場クラス含む）: 1 選手 O(m log m) ----
  // ウォームアップ（adapter のメタ/information キャッシュを埋め、初回 I/O を除く）
  buildFacts(ALL_FIXTURES[0].id, adapter, identity, reverseIndex);

  const perMatchRates: number[] = [];
  let maxFixtureMs = 0;
  for (const fx of ALL_FIXTURES) {
    const s = performance.now();
    const facts = buildFacts(fx.id, adapter, identity, reverseIndex);
    const ms = performance.now() - s;
    maxFixtureMs = Math.max(maxFixtureMs, ms);
    const m = facts.matches.length;
    if (m > 0) perMatchRates.push(ms / m);
    log(`  player ${fx.id} (${fx.name}): ${ms.toFixed(1)}ms, ${m} matches (${m > 0 ? (ms / m).toFixed(2) : '-'} ms/match)`);
  }
  const okPlayer = maxFixtureMs <= BUDGET_PLAYER_MS;
  log(`single-player max: ${maxFixtureMs.toFixed(1)}ms ${okPlayer ? '✓' : `✗ (budget ${BUDGET_PLAYER_MS}ms)`}`);
  if (!okPlayer) failed += 1;

  // ---- 3. ランダムサンプルでフルビルド外挿・線形性 ----
  const allIds = Object.keys(reverseIndex).map((k) => Number(k));
  const rand = mulberry32(20260702);
  const shuffled = [...allIds].sort(() => rand() - 0.5);
  const sample = shuffled.slice(0, Math.min(sampleN, shuffled.length));

  const sampleRates: number[] = [];
  let sampleMs = 0;
  let sampleMatches = 0;
  for (const id of sample) {
    const s = performance.now();
    const facts = buildFacts(id, adapter, identity, reverseIndex);
    const ms = performance.now() - s;
    sampleMs += ms;
    sampleMatches += facts.matches.length;
    if (facts.matches.length > 0) sampleRates.push(ms / facts.matches.length);
  }
  const estFullMs = (sampleMs / sample.length) * allIds.length;
  const okFull = estFullMs <= BUDGET_FULL_MS;
  log(
    `sample: ${sample.length} players, ${sampleMatches} matches in ${sampleMs.toFixed(0)}ms -> full-build estimate ${(estFullMs / 1000).toFixed(1)}s ${okFull ? '✓' : `✗ (budget ${BUDGET_FULL_MS / 1000}s)`}`,
  );
  if (!okFull) failed += 1;

  // 線形性: 最多出場クラス（fixtures）の ms/match が全体中央値の一定倍以内
  const med = median([...sampleRates, ...perMatchRates]);
  const highVolumeRate = Math.max(...perMatchRates);
  const okLinear = med === 0 || highVolumeRate <= med * LINEARITY_FACTOR;
  log(`linearity: median ${med.toFixed(2)} ms/match, high-volume max ${highVolumeRate.toFixed(2)} ms/match ${okLinear ? '✓' : `✗ (> x${LINEARITY_FACTOR})`}`);
  if (!okLinear) failed += 1;

  log(failed === 0 ? 'ALL BUDGETS MET' : `${failed} CHECK(S) FAILED`);
  if (failed > 0) process.exitCode = 1;
}

main();
