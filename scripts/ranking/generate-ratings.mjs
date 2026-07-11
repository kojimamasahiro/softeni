#!/usr/bin/env node
/**
 * Elo副指標（P3）: レーティング生成
 *
 * data/tournaments/details/** の全対戦を時系列再生し、選手ごとの統合Eloレーティングを
 * data/ratings/current.json に出力する。**当面は内部生成物**（公開ページ未接続）。
 * giant-killing判定・tier監査・スタイル分析のスキル統制の基盤として使う。
 *
 * 設計決定（2026-07-11、docs/raw/2026-07-11-ranking-calibration-harness-plan.md §10）:
 *  - レートは選手1人に1本（singles/doubles/混合を統合。較正はこの前提で実施済み）
 *  - K は ranking-config.json rating.kByTier（バックテスト較正済み: K/scale比0.16がBrier最良）
 *  - ダブルスはペア平均レートで期待勝率を計算し、両選手に同じデルタを適用
 *  - retired（不戦勝/棄権）は更新しない
 *  - 除外・tierOverrides は本 config を常時ミラー（replayData.mjs）
 *  - 名前ベース同定（同姓同名の融合を許容）。将来の公開接続用に playerId を join する
 *
 * 実行: node scripts/ranking/generate-ratings.mjs [--out data/ratings/current.json]
 *       ranking-config.json の rating.enabled=false の場合は警告して終了（--force で強制実行）
 */

import fs from 'node:fs';
import path from 'node:path';

import { ROOT, buildReplay } from './replayData.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT_PATH = opt('out', path.join('data', 'ratings', 'current.json'));
const FORCE = args.includes('--force');

const replay = buildReplay();
const { rankingConfig, matches, homonymNames } = replay;
const rating = rankingConfig.ranking.rating;

if (!rating.enabled && !FORCE) {
  console.error('[generate-ratings] rating.enabled=false のため実行しません（--force で強制実行）。');
  process.exit(1);
}

const K_BY_TIER = rating.kByTier;
const INITIAL = rating.initial;
const SCALE = 400; // 較正は K/scale 比で実施。scale は 400 固定とし K 側で調整する
const PROVISIONAL_MATCHES = rating.provisionalMatches;

// ---------- Elo 再生 ----------
const R = new Map(); // name → rating
const N = new Map(); // name → 試合数（retired除く）
const W = new Map(); // name → 勝数
const LAST_YEAR = new Map(); // name → 最終出場年度
const getR = (p) => R.get(p) ?? INITIAL;
const getN = (p) => N.get(p) ?? 0;

for (const m of matches) {
  for (const p of [...m.sideA, ...m.sideB]) LAST_YEAR.set(p, Math.max(LAST_YEAR.get(p) ?? 0, m.year));
  if (m.retired) continue;
  const ra = m.sideA.reduce((s, p) => s + getR(p), 0) / m.sideA.length;
  const rb = m.sideB.reduce((s, p) => s + getR(p), 0) / m.sideB.length;
  const ea = 1 / (1 + 10 ** ((rb - ra) / SCALE));
  const k = K_BY_TIER[replay.tierOfPoints(m.tid)] ?? K_BY_TIER.national;
  const delta = k * ((m.winner === 0 ? 1 : 0) - ea);
  for (const p of m.sideA) {
    R.set(p, getR(p) + delta);
    N.set(p, getN(p) + 1);
    if (m.winner === 0) W.set(p, (W.get(p) ?? 0) + 1);
  }
  for (const p of m.sideB) {
    R.set(p, getR(p) - delta);
    N.set(p, getN(p) + 1);
    if (m.winner === 1) W.set(p, (W.get(p) ?? 0) + 1);
  }
}

// ---------- playerId join（将来の公開接続用） ----------
const idByName = new Map();
{
  const p = path.join(ROOT, 'data', 'players', 'index.json');
  if (fs.existsSync(p)) {
    for (const row of JSON.parse(fs.readFileSync(p, 'utf-8'))) {
      const name = `${row.lastName ?? ''}${row.firstName ?? ''}`.trim();
      if (name && row.id !== undefined && !idByName.has(name)) idByName.set(name, row.id);
    }
  }
}

// ---------- 出力 ----------
const entries = [...R.entries()]
  .map(([name, r]) => ({
    playerName: name,
    playerId: idByName.get(name) ?? null,
    rating: Math.round(r),
    matches: N.get(name) ?? 0,
    wins: W.get(name) ?? 0,
    lastActiveYear: LAST_YEAR.get(name) ?? null,
    established: (N.get(name) ?? 0) >= PROVISIONAL_MATCHES,
    homonymRisk: homonymNames.has(name) || undefined,
  }))
  .sort((a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName, 'ja'));

// established のみ順位を振る（provisional は掲載するが無順位）
let rank = 0;
let prevRating = null;
let seen = 0;
for (const e of entries) {
  if (!e.established) continue;
  seen += 1;
  if (e.rating !== prevRating) rank = seen; // 1224方式
  prevRating = e.rating;
  e.rank = rank;
}

const out = {
  generatedAt: new Date().toISOString(),
  _readme:
    '内部生成物（公開ページ未接続、2026-07-11決定）。統合Elo（選手1本）。scope: 当サイト掲載大会分のみ・名前ベース同定（同姓同名融合を許容、homonymRisk 参照）。生成: scripts/ranking/generate-ratings.mjs。設計: docs/raw/2026-07-11-ranking-calibration-harness-plan.md §10',
  engine: {
    kByTier: K_BY_TIER,
    scale: SCALE,
    initial: INITIAL,
    provisionalMatches: PROVISIONAL_MATCHES,
    excludeTournaments: rankingConfig.ranking.excludeTournaments ?? [],
  },
  dataQuality: {
    matchesReplayed: matches.filter((m) => !m.retired).length,
    players: entries.length,
    establishedPlayers: entries.filter((e) => e.established).length,
  },
  entries,
};

const outAbs = path.resolve(ROOT, OUT_PATH);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, JSON.stringify(out), 'utf-8');
console.log(
  `[generate-ratings] wrote ${path.relative(ROOT, outAbs)} | players ${out.dataQuality.players} (established ${out.dataQuality.establishedPlayers}) | matches ${out.dataQuality.matchesReplayed}`,
);
