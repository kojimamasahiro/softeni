#!/usr/bin/env node
/**
 * ランキング較正ハーネス: バックテスト
 *
 * data/tournaments/details/** の全対戦結果を時系列再生し、
 * 「上位認定した側が実際に勝った率」（予測的中率）でランキング/レーティングの精度を測る。
 *
 * 評価対象:
 *  - elo:    Elo副指標（ranking-config.json の rating 設定。K は tier 別）
 *  - points: 現行ポイント式ランキング（生成済み data/rankings/{year}-{disc}-{gender}.json を
 *            「前年度スナップショット」として対戦予測に使う。Assumption: 読者が対戦時点で
 *            参照できるのは前年度ランキング、という解釈）
 *
 * 設計と背景: docs/raw/2026-07-11-ranking-calibration-harness-plan.md
 *
 * 使い方:
 *   node scripts/ranking/backtest.mjs [options]
 *
 * Options:
 *   --evaluator elo|points|both   評価対象（既定 both）
 *   --k-mode tier|uniform         Elo の K を tier 別にするか一律か（既定 tier）
 *   --k <num>                     uniform 時の K（既定 32）
 *   --min-prior <n>               的中率集計のゲート: 両者の既知試合数下限（既定 5）
 *   --holdout-year <year>         このyear以降を holdout として分割報告（既定なし）
 *   --provisional-boost <mult>    既知試合数 < provisionalMatches の選手の K 倍率（既定 1 = 無効）
 *   --exclude-homonyms            homonyms.json 該当名の対戦を的中率集計から除外（更新はする）
 *   --scale <num>                 Elo の期待勝率スケール（既定 400。小さいほどレート差を強く効かせる）
 *   --out <path>                  メトリクス JSON の出力先（既定: 出力しない）
 *
 * 較正モード（P2。指定時は通常評価の代わりに実行。--holdout-year 併用を推奨）:
 *   --sweep-elo                   K × scale をスイープし fit/holdout 的中率の表を出す
 *   --grid-points                 ポイント式の tier比・順位係数・topN をグリッドサーチ。
 *                                 details の placement からシーズンポイントを再計算する
 *                                 （lib/playerStats/aggregators/rankingCompute.ts と同式のミラー。
 *                                 名寄せ・エイリアス解決は簡略なので絶対値は本エンジンと微差が出る。
 *                                 現行 config の再現値と data/rankings 由来の値の差を必ず併記する）
 *   --rated-tier                  実験（3b）: tier重みを固定値でなく「大会参加者の事前レート平均」
 *                                 から導出した場合のポイント式を評価。大会強度は時系列Elo再生の
 *                                 大会開始時点スナップショット（先読みなし）。設計論点は
 *                                 docs/raw/2026-07-11-ranking-calibration-harness-plan.md §9
 *   --exclude-international       真の国際大会（generationId='international'。外国選手が参加し
 *                                 レートの信頼性が担保できない）を再生・評価から除外
 *   --retier                      tier再分類の実験案を適用（国際予選→major、
 *                                 lucent-tokyo-indoor→major、yonex-hokkaido-international→national。
 *                                 監査（--rated-tier）で検出したミスプライシングの修正案）
 */

import fs from 'node:fs';
import path from 'node:path';

import { ROOT, buildReplay, loadRankingsLookup } from './replayData.mjs';

// ---------- CLI ----------
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(`--${name}`);

const EVALUATOR = opt('evaluator', 'both');
const K_MODE = opt('k-mode', 'tier');
const K_UNIFORM = Number(opt('k', '32'));
const MIN_PRIOR = Number(opt('min-prior', '5'));
const HOLDOUT_YEAR = opt('holdout-year', null) ? Number(opt('holdout-year', null)) : null;
const PROVISIONAL_BOOST = Number(opt('provisional-boost', '1'));
const EXCLUDE_HOMONYMS = flag('exclude-homonyms');
const SCALE = Number(opt('scale', '400'));
const OUT_PATH = opt('out', null);
const SWEEP_ELO = flag('sweep-elo');
const GRID_POINTS = flag('grid-points');
const RATED_TIER = flag('rated-tier');
const EXCLUDE_INTERNATIONAL = flag('exclude-international');
// --retier: 精鋭大会を major へ / --retier-national: 同じ対象を national へ（実績表彰として控えめな案）
const RETIER = flag('retier') || flag('retier-national');
const RETIER_TARGET = flag('retier-national') ? 'national' : 'major';

// ---------- 設定・マスタ・対戦データ（共通モジュール） ----------
// --retier: 監査で検出したミスプライシングの修正案（国内精鋭のみ。国際予選は全員国内選手を確認済み）
const RETIER_MAP = RETIER
  ? new Map([
      ['world-championship-qualifier', RETIER_TARGET],
      ['asian-championship-qualifier', RETIER_TARGET],
      ['asian-games-qualifier', RETIER_TARGET],
      ['lucent-tokyo-indoor', RETIER_TARGET],
      ['yonex-hokkaido-international', 'national'],
    ])
  : null;

const replay = buildReplay({
  excludeGenerationInternational: EXCLUDE_INTERNATIONAL,
  retierMap: RETIER_MAP,
  collectPlacements: GRID_POINTS || RATED_TIER,
});
const { rankingConfig, matches, placements, files, skipped, dateByTidYear, homonymNames } = replay;
const tierOf = replay.tierOfElo;
const tierOfPoints = replay.tierOfPoints;

const rating = rankingConfig.ranking.rating;
const K_BY_TIER = rating.kByTier; // { major, national, local }
const INITIAL = rating.initial;
const PROVISIONAL_MATCHES = rating.provisionalMatches;

// 前年度ポイントランキング: `${year}\t${discipline}\t${gender}` → Map(name → points)
const rankingsLookup = loadRankingsLookup();

// ---------- 集計ヘルパ ----------
const makeScore = () => ({ correct: 0, total: 0 });
const acc = (s) => (s.total ? s.correct / s.total : null);
const addScore = (s, ok) => {
  s.total += 1;
  if (ok) s.correct += 1;
};

// ---------- Elo 評価 ----------
function runElo(params = {}) {
  const kMode = params.kMode ?? K_MODE;
  const kUniform = params.kUniform ?? K_UNIFORM;
  const scale = params.scale ?? SCALE;
  const R = new Map();
  const N = new Map();
  const getR = (p) => R.get(p) ?? INITIAL;
  const getN = (p) => N.get(p) ?? 0;

  const overall = makeScore();
  const gated = makeScore();
  const fit = makeScore();
  const holdout = makeScore();
  const byYear = new Map();
  const buckets = new Map(); // gapBucket → { correct, total, probSum }
  // Brier スコア（確率較正の指標。小さいほど良い。giant-killing の確率定義にはこちらが効く）
  const brier = { gated: { sum: 0, n: 0 }, fit: { sum: 0, n: 0 }, holdout: { sum: 0, n: 0 } };
  const addBrier = (b, ea, saVal) => {
    b.sum += (ea - saVal) ** 2;
    b.n += 1;
  };
  const brierOf = (b) => (b.n ? b.sum / b.n : null);

  for (const m of matches) {
    const ra = m.sideA.reduce((s, p) => s + getR(p), 0) / m.sideA.length;
    const rb = m.sideB.reduce((s, p) => s + getR(p), 0) / m.sideB.length;
    const ea = 1 / (1 + 10 ** ((rb - ra) / scale));

    if (!m.retired) {
      const isHomonym = [...m.sideA, ...m.sideB].some((p) => homonymNames.has(p));
      const scoreIt = !(EXCLUDE_HOMONYMS && isHomonym) && Math.abs(ra - rb) > 1e-9;
      if (scoreIt) {
        const pred = ra > rb ? 0 : 1;
        const ok = pred === m.winner;
        addScore(overall, ok);
        const na = Math.min(...m.sideA.map(getN));
        const nb = Math.min(...m.sideB.map(getN));
        if (na >= MIN_PRIOR && nb >= MIN_PRIOR) {
          addScore(gated, ok);
          const saVal = m.winner === 0 ? 1 : 0;
          addBrier(brier.gated, ea, saVal);
          if (!byYear.has(m.year)) byYear.set(m.year, makeScore());
          addScore(byYear.get(m.year), ok);
          if (HOLDOUT_YEAR !== null) {
            addScore(m.year >= HOLDOUT_YEAR ? holdout : fit, ok);
            addBrier(m.year >= HOLDOUT_YEAR ? brier.holdout : brier.fit, ea, saVal);
          }
          const gap = Math.abs(ra - rb);
          const b = Math.min(Math.floor(gap / 50) * 50, 300);
          if (!buckets.has(b)) buckets.set(b, { correct: 0, total: 0, probSum: 0 });
          const bk = buckets.get(b);
          bk.total += 1;
          if (ok) bk.correct += 1;
          bk.probSum += Math.max(ea, 1 - ea);
        }
      }

      const kBase = kMode === 'tier' ? K_BY_TIER[tierOf(m.tid)] : kUniform;
      const sa = m.winner === 0 ? 1 : 0;
      const deltaBase = sa - ea;
      for (const p of m.sideA) {
        const k = kBase * (getN(p) < PROVISIONAL_MATCHES ? PROVISIONAL_BOOST : 1);
        R.set(p, getR(p) + k * deltaBase);
        N.set(p, getN(p) + 1);
      }
      for (const p of m.sideB) {
        const k = kBase * (getN(p) < PROVISIONAL_MATCHES ? PROVISIONAL_BOOST : 1);
        R.set(p, getR(p) - k * deltaBase);
        N.set(p, getN(p) + 1);
      }
    }
  }

  return {
    evaluator: 'elo',
    params: {
      kMode,
      kUniform: kMode === 'uniform' ? kUniform : null,
      kByTier: kMode === 'tier' ? K_BY_TIER : null,
      scale,
      initial: INITIAL,
      provisionalBoost: PROVISIONAL_BOOST,
      provisionalMatches: PROVISIONAL_MATCHES,
      minPrior: MIN_PRIOR,
      excludeHomonyms: EXCLUDE_HOMONYMS,
    },
    players: R.size,
    overall: { ...overall, accuracy: acc(overall) },
    gated: { ...gated, accuracy: acc(gated), brier: brierOf(brier.gated) },
    brier: {
      gated: brierOf(brier.gated),
      fit: brierOf(brier.fit),
      holdout: brierOf(brier.holdout),
    },
    holdoutSplit:
      HOLDOUT_YEAR === null
        ? null
        : {
            holdoutYear: HOLDOUT_YEAR,
            fit: { ...fit, accuracy: acc(fit) },
            holdout: { ...holdout, accuracy: acc(holdout) },
          },
    byYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, s]) => ({ year, ...s, accuracy: acc(s) })),
    calibration: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gapFrom, bk]) => ({
        gapFrom,
        gapTo: gapFrom >= 300 ? null : gapFrom + 49,
        n: bk.total,
        accuracy: bk.correct / bk.total,
        meanExpectedFavoriteProb: bk.probSum / bk.total,
      })),
  };
}

// ---------- ポイント式ランキング評価（前年度スナップショット） ----------
function runPoints() {
  const overall = makeScore();
  const fit = makeScore();
  const holdout = makeScore();
  const byYear = new Map();
  let eligible = 0; // singles/doubles × boys/girls で非 retired の対戦数

  for (const m of matches) {
    if (m.retired) continue;
    if (!m.discipline || !m.gender) continue;
    if (m.discipline === 'team' || m.gender === 'mixed') continue;
    eligible += 1;
    const lookup = rankingsLookup.get(`${m.year - 1}\t${m.discipline}\t${m.gender}`);
    if (!lookup) continue;
    if (EXCLUDE_HOMONYMS && [...m.sideA, ...m.sideB].some((p) => homonymNames.has(p))) continue;
    const ptsOf = (side) => {
      const vals = side.map((p) => lookup.get(p));
      if (vals.some((v) => v === undefined)) return null; // 全員が前年度ランキング掲載であること
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const pa = ptsOf(m.sideA);
    const pb = ptsOf(m.sideB);
    if (pa === null || pb === null || pa === pb) continue;
    const ok = (pa > pb ? 0 : 1) === m.winner;
    addScore(overall, ok);
    if (!byYear.has(m.year)) byYear.set(m.year, makeScore());
    addScore(byYear.get(m.year), ok);
    if (HOLDOUT_YEAR !== null) addScore(m.year >= HOLDOUT_YEAR ? holdout : fit, ok);
  }

  return {
    evaluator: 'points',
    params: {
      snapshot: 'previous-season',
      note: 'Assumption: 対戦時点で参照可能なのは前年度ランキング。両サイド全員が前年度掲載の対戦のみ判定',
      excludeHomonyms: EXCLUDE_HOMONYMS,
    },
    eligibleMatches: eligible,
    coverage: eligible ? overall.total / eligible : null,
    overall: { ...overall, accuracy: acc(overall) },
    holdoutSplit:
      HOLDOUT_YEAR === null
        ? null
        : {
            holdoutYear: HOLDOUT_YEAR,
            fit: { ...fit, accuracy: acc(fit) },
            holdout: { ...holdout, accuracy: acc(holdout) },
          },
    byYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, s]) => ({ year, ...s, accuracy: acc(s) })),
  };
}

// ---------- P2: Elo K × scale スイープ ----------
function runEloSweep() {
  const Ks = [16, 24, 32, 48, 64, 96, 128];
  const scales = [200, 300, 400, 600];
  const rows = [];
  for (const scale of scales) {
    for (const k of Ks) {
      const r = runElo({ kMode: 'uniform', kUniform: k, scale });
      rows.push({
        k,
        scale,
        gatedAccuracy: r.gated.accuracy,
        fit: r.holdoutSplit?.fit.accuracy ?? null,
        holdout: r.holdoutSplit?.holdout.accuracy ?? null,
        brierFit: r.brier.fit ?? r.brier.gated,
        brierHoldout: r.brier.holdout,
        n: r.gated.total,
      });
    }
  }
  // 的中率はK/scaleにほぼ不感（順序の符号しか使わないため）。較正の主指標は Brier（昇順=良）
  rows.sort((a, b) => (a.brierFit ?? 1) - (b.brierFit ?? 1));
  return { evaluator: 'elo-sweep', params: { Ks, scales, minPrior: MIN_PRIOR, holdoutYear: HOLDOUT_YEAR }, rows };
}

// ---------- P2: ポイント式グリッドサーチ ----------
// placements からシーズンポイントを再計算し（rankingCompute.ts と同式）、前年度スナップショット
// 予測の的中率で tier比・順位係数・topN を比較する。
function runPointsGrid() {
  // グループ化: name×year×discipline×gender → [{tier, coefKey}]
  const groups = new Map();
  for (const p of placements) {
    const key = `${p.name}\t${p.year}\t${p.discipline}\t${p.gender}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  // 評価対象の対戦を先に絞る
  const evalMatches = matches.filter(
    (m) =>
      !m.retired &&
      (m.discipline === 'singles' || m.discipline === 'doubles') &&
      (m.gender === 'boys' || m.gender === 'girls') &&
      !(EXCLUDE_HOMONYMS && [...m.sideA, ...m.sideB].some((p) => homonymNames.has(p))),
  );

  const cur = rankingConfig.ranking;
  const coefSets = {
    current: cur.placementCoefficient,
    steep: { winner: 1.0, runnerup: 0.6, best4: 0.35, best8: 0.2, entry: 0.05 },
    flat: { winner: 1.0, runnerup: 0.8, best4: 0.6, best8: 0.4, entry: 0.2 },
  };
  const tierNationals = [0.3, 0.45, 0.6, 0.8]; // major=1 に対する比
  const tierLocals = [0.1, 0.2, 0.3];
  const topNs = [2, 3, 4, 5];

  const evaluate = (tierW, coef, topN) => {
    // シーズンポイント算出
    const season = new Map();
    for (const [key, list] of groups) {
      const scores = list.map((p) => tierW[p.tier] * coef[p.coefKey]);
      scores.sort((a, b) => b - a);
      let sum = 0;
      const n = Math.min(topN, scores.length);
      for (let i = 0; i < n; i++) sum += scores[i];
      if (sum > 0) season.set(key, sum);
    }
    const score = makeScore();
    const fit = makeScore();
    const holdout = makeScore();
    for (const m of evalMatches) {
      const ptsOf = (side) => {
        let sum = 0;
        for (const p of side) {
          const v = season.get(`${p}\t${m.year - 1}\t${m.discipline}\t${m.gender}`);
          if (v === undefined) return null;
          sum += v;
        }
        return sum / side.length;
      };
      const pa = ptsOf(m.sideA);
      const pb = ptsOf(m.sideB);
      if (pa === null || pb === null || pa === pb) continue;
      const ok = (pa > pb ? 0 : 1) === m.winner;
      addScore(score, ok);
      if (HOLDOUT_YEAR !== null) addScore(m.year >= HOLDOUT_YEAR ? holdout : fit, ok);
    }
    return {
      accuracy: acc(score),
      n: score.total,
      coverage: evalMatches.length ? score.total / evalMatches.length : null,
      fit: HOLDOUT_YEAR === null ? null : acc(fit),
      holdout: HOLDOUT_YEAR === null ? null : acc(holdout),
    };
  };

  const rows = [];
  for (const [coefName, coef] of Object.entries(coefSets)) {
    for (const tn of tierNationals) {
      for (const tl of tierLocals) {
        if (tl >= tn) continue; // local >= national は除外
        for (const topN of topNs) {
          const tierW = { major: cur.tier.major, national: cur.tier.major * tn, local: cur.tier.major * tl };
          rows.push({ coefSet: coefName, tierNational: tn, tierLocal: tl, topN, ...evaluate(tierW, coef, topN) });
        }
      }
    }
  }
  rows.sort((a, b) => (b.fit ?? b.accuracy) - (a.fit ?? a.accuracy));

  // 現行 config の再現（サニティチェック: data/rankings ベースの runPoints() と比較するための行）
  const currentReplay = evaluate(cur.tier, cur.placementCoefficient, cur.topNTournamentsPerSeason);

  return {
    evaluator: 'points-grid',
    params: {
      note: '本エンジンのミラー実装による再計算。名寄せ簡略化のため絶対値は generate-rankings.ts と微差あり',
      holdoutYear: HOLDOUT_YEAR,
      excludeHomonyms: EXCLUDE_HOMONYMS,
      gridSize: rows.length,
      placementRows: placements.length,
      seasonGroups: groups.size,
    },
    currentReplay: {
      coefSet: 'current',
      tierNational: cur.tier.national / cur.tier.major,
      tierLocal: cur.tier.local / cur.tier.major,
      topN: cur.topNTournamentsPerSeason,
      ...currentReplay,
    },
    rows,
  };
}

// ---------- 実験（3b）: レート由来の動的tier重み ----------
// tier重み（現行 100/60/20 の固定値）を「大会参加者の事前レート平均」から導出したポイント式を評価。
// 大会強度は時系列Elo再生（較正済み K=64/scale400 相当）の大会開始時点スナップショット＝先読みなし。
function runRatedTier() {
  // --- pass1: Elo 再生しつつ、大会×年ごとに「初登場時点のレート」を集める ---
  const R = new Map();
  const N = new Map();
  const getR = (p) => R.get(p) ?? INITIAL;
  const getN = (p) => N.get(p) ?? 0;
  const K = 64;
  const ELO_SCALE = 400;
  const MIN_PRIOR_FOR_STRENGTH = 3; // レートが動き始めた選手のみ強度計算に使う
  const MIN_PLAYERS_FOR_STRENGTH = 10; // これ未満の大会は強度不明としてフォールバック
  const tourAcc = new Map(); // `${tid}\t${year}` → { sum, count }
  const seenInTour = new Map(); // `${tid}\t${year}` → Set(player)

  for (const m of matches) {
    const key = `${m.tid}\t${m.year}`;
    if (!seenInTour.has(key)) {
      seenInTour.set(key, new Set());
      tourAcc.set(key, { sum: 0, count: 0 });
    }
    const seen = seenInTour.get(key);
    for (const p of [...m.sideA, ...m.sideB]) {
      if (!seen.has(p)) {
        seen.add(p);
        if (getN(p) >= MIN_PRIOR_FOR_STRENGTH) {
          const a = tourAcc.get(key);
          a.sum += getR(p);
          a.count += 1;
        }
      }
    }
    if (!m.retired) {
      const ra = m.sideA.reduce((s, p) => s + getR(p), 0) / m.sideA.length;
      const rb = m.sideB.reduce((s, p) => s + getR(p), 0) / m.sideB.length;
      const ea = 1 / (1 + 10 ** ((rb - ra) / ELO_SCALE));
      const deltaBase = (m.winner === 0 ? 1 : 0) - ea;
      for (const p of m.sideA) {
        R.set(p, getR(p) + K * deltaBase);
        N.set(p, getN(p) + 1);
      }
      for (const p of m.sideB) {
        R.set(p, getR(p) - K * deltaBase);
        N.set(p, getN(p) + 1);
      }
    }
  }

  const strength = new Map(); // key → 平均レート or null
  let known = 0;
  for (const [key, a] of tourAcc) {
    const v = a.count >= MIN_PLAYERS_FOR_STRENGTH ? a.sum / a.count : null;
    strength.set(key, v);
    if (v !== null) known += 1;
  }
  const knownValues = [...strength.values()].filter((v) => v !== null);
  const meanStrength = knownValues.reduce((s, v) => s + v, 0) / (knownValues.length || 1);

  // --- 重み写像（正規化定数は予測比較に影響しないため、形だけ変える） ---
  const mappings = {
    'exp200': (r) => 10 ** ((r - 1500) / 200), // レート差を強く効かせる
    'exp400': (r) => 10 ** ((r - 1500) / 400), // Elo素直（+400で10倍）
    'linear': (r) => Math.max(r - 1200, 1), // ゆるやか（線形）
  };

  // --- グループ化（grid と同じ）＋評価 ---
  const groups = new Map();
  for (const p of placements) {
    const key = `${p.name}\t${p.year}\t${p.discipline}\t${p.gender}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const evalMatches = matches.filter(
    (m) =>
      !m.retired &&
      (m.discipline === 'singles' || m.discipline === 'doubles') &&
      (m.gender === 'boys' || m.gender === 'girls') &&
      !(EXCLUDE_HOMONYMS && [...m.sideA, ...m.sideB].some((p) => homonymNames.has(p))),
  );
  const cur = rankingConfig.ranking;
  const coefSets = {
    current: cur.placementCoefficient,
    flat: { winner: 1.0, runnerup: 0.8, best4: 0.6, best8: 0.4, entry: 0.2 },
  };

  const evaluate = (weightOf, coef, topN) => {
    const season = new Map();
    for (const [key, list] of groups) {
      const scores = list.map((p) => weightOf(p) * coef[p.coefKey]);
      scores.sort((a, b) => b - a);
      let sum = 0;
      const n = Math.min(topN, scores.length);
      for (let i = 0; i < n; i++) sum += scores[i];
      if (sum > 0) season.set(key, sum);
    }
    const score = makeScore();
    const fit = makeScore();
    const holdout = makeScore();
    for (const m of evalMatches) {
      const ptsOf = (side) => {
        let sum = 0;
        for (const p of side) {
          const v = season.get(`${p}\t${m.year - 1}\t${m.discipline}\t${m.gender}`);
          if (v === undefined) return null;
          sum += v;
        }
        return sum / side.length;
      };
      const pa = ptsOf(m.sideA);
      const pb = ptsOf(m.sideB);
      if (pa === null || pb === null || pa === pb) continue;
      const ok = (pa > pb ? 0 : 1) === m.winner;
      addScore(score, ok);
      if (HOLDOUT_YEAR !== null) addScore(m.year >= HOLDOUT_YEAR ? holdout : fit, ok);
    }
    return {
      accuracy: acc(score),
      n: score.total,
      fit: HOLDOUT_YEAR === null ? null : acc(fit),
      holdout: HOLDOUT_YEAR === null ? null : acc(holdout),
    };
  };

  const rows = [];
  for (const [mapName, mapFn] of Object.entries(mappings)) {
    const weightOf = (p) => {
      const s = strength.get(`${p.tid}\t${p.year}`);
      return mapFn(s ?? meanStrength);
    };
    for (const [coefName, coef] of Object.entries(coefSets)) {
      for (const topN of [2, 3]) {
        rows.push({ tierSource: `rated:${mapName}`, coefSet: coefName, topN, ...evaluate(weightOf, coef, topN) });
      }
    }
  }
  // 静的tierの比較行（現行 + P2グリッド最良）
  const staticW = (tierW) => (p) => tierW[p.tier];
  rows.push({
    tierSource: 'static:current(100/60/20)',
    coefSet: 'current',
    topN: cur.topNTournamentsPerSeason,
    ...evaluate(staticW(cur.tier), cur.placementCoefficient, cur.topNTournamentsPerSeason),
  });
  rows.push({
    tierSource: 'static:P2best(100/45/10)',
    coefSet: 'flat',
    topN: 2,
    ...evaluate(staticW({ major: 100, national: 45, local: 10 }), coefSets.flat, 2),
  });
  rows.sort((a, b) => (b.fit ?? b.accuracy) - (a.fit ?? a.accuracy));

  // サニティチェック: 導出された大会強度の上位（majorが上に来るか）
  const topTournaments = [...strength.entries()]
    .filter(([, v]) => v !== null)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, v]) => {
      const [tid, year] = key.split('\t');
      return { tid, year: Number(year), meanRating: Math.round(v), currentTier: tierOfPoints(tid) };
    });

  return {
    evaluator: 'rated-tier',
    params: {
      k: K,
      scale: ELO_SCALE,
      minPriorForStrength: MIN_PRIOR_FOR_STRENGTH,
      minPlayersForStrength: MIN_PLAYERS_FOR_STRENGTH,
      holdoutYear: HOLDOUT_YEAR,
      tournamentsWithStrength: known,
      tournamentsTotal: strength.size,
      meanStrength: Math.round(meanStrength),
    },
    rows,
    topTournaments,
  };
}

// ---------- 実行・出力 ----------
const results = [];
if (SWEEP_ELO) results.push(runEloSweep());
if (GRID_POINTS) results.push(runPointsGrid());
if (RATED_TIER) results.push(runRatedTier());
if (!SWEEP_ELO && !GRID_POINTS && !RATED_TIER) {
  if (EVALUATOR === 'elo' || EVALUATOR === 'both') results.push(runElo());
  if (EVALUATOR === 'points' || EVALUATOR === 'both') results.push(runPoints());
}

const metrics = {
  generatedAt: new Date().toISOString(),
  dataQuality: {
    detailFiles: files.length,
    usableMatches: matches.length,
    retiredExcludedFromScoring: matches.filter((m) => m.retired).length,
    datedTournamentYears: dateByTidYear.size,
    skipped,
  },
  results,
};

const pct = (v) => (v === null || v === undefined ? '  -  ' : `${(v * 100).toFixed(1)}%`);
console.log(`対象: ${matches.length}試合（detailsファイル ${files.length}件）`);
for (const r of results) {
  console.log(`\n=== ${r.evaluator} ===`);
  if (r.evaluator === 'elo-sweep') {
    console.log('  K × scale スイープ（Brier fit 昇順=較正が良い順・上位15）:');
    console.log('    K    scale  acc(fit) acc(hold) Brier(fit) Brier(hold)  n');
    for (const row of r.rows.slice(0, 15)) {
      const b = (v) => (v === null || v === undefined ? '  -   ' : v.toFixed(4));
      console.log(
        `    ${String(row.k).padEnd(4)} ${String(row.scale).padEnd(6)} ${pct(row.fit)}    ${pct(row.holdout)}    ${b(row.brierFit)}     ${b(row.brierHoldout)}   ${row.n}`,
      );
    }
    continue;
  }
  if (r.evaluator === 'points-grid') {
    const fmt = (row) =>
      `coef=${String(row.coefSet).padEnd(7)} national=${row.tierNational} local=${row.tierLocal} topN=${row.topN}` +
      ` → fit ${pct(row.fit ?? row.accuracy)} / holdout ${pct(row.holdout)} (n=${row.n}, cov=${pct(row.coverage)})`;
    console.log(`  グリッド ${r.params.gridSize}通り（placement ${r.params.placementRows}行）`);
    console.log(`  現行configの再現: ${fmt(r.currentReplay)}`);
    console.log('  上位10:');
    for (const row of r.rows.slice(0, 10)) console.log(`    ${fmt(row)}`);
    continue;
  }
  if (r.evaluator === 'rated-tier') {
    console.log(
      `  大会強度算出: ${r.params.tournamentsWithStrength}/${r.params.tournamentsTotal}大会（平均レート ${r.params.meanStrength}）`,
    );
    console.log('  fit 降順:');
    for (const row of r.rows) {
      console.log(
        `    tier=${String(row.tierSource).padEnd(26)} coef=${String(row.coefSet).padEnd(7)} topN=${row.topN} → fit ${pct(row.fit ?? row.accuracy)} / holdout ${pct(row.holdout)} (n=${row.n})`,
      );
    }
    console.log('  導出された大会強度 上位10（サニティチェック）:');
    for (const t of r.topTournaments) {
      console.log(`    ${String(t.meanRating).padEnd(5)} ${t.tid} ${t.year} [現行tier=${t.currentTier}]`);
    }
    continue;
  }
  if (r.evaluator === 'elo') {
    console.log(`  的中率 全体: ${pct(r.overall.accuracy)} (${r.overall.correct}/${r.overall.total})`);
    console.log(`  的中率 両者${MIN_PRIOR}試合以上: ${pct(r.gated.accuracy)} (${r.gated.correct}/${r.gated.total})`);
    console.log('  較正曲線（ゲート済み）:');
    for (const b of r.calibration) {
      const range = b.gapTo === null ? `${b.gapFrom}+   ` : `${b.gapFrom}-${b.gapTo}`;
      console.log(`    Elo差 ${range.padEnd(8)} 実測${pct(b.accuracy)} 理論${pct(b.meanExpectedFavoriteProb)} (n=${b.n})`);
    }
  } else {
    console.log(`  的中率（両サイド前年度掲載のみ）: ${pct(r.overall.accuracy)} (${r.overall.correct}/${r.overall.total})`);
    console.log(`  カバレッジ: ${pct(r.coverage)} （判定可能 ${r.overall.total} / 対象 ${r.eligibleMatches}）`);
  }
  if (r.holdoutSplit) {
    console.log(
      `  fit(<${r.holdoutSplit.holdoutYear}): ${pct(r.holdoutSplit.fit.accuracy)} / holdout(>=${r.holdoutSplit.holdoutYear}): ${pct(r.holdoutSplit.holdout.accuracy)}`,
    );
  }
  console.log('  年別:');
  for (const y of r.byYear) console.log(`    ${y.year}: ${pct(y.accuracy)} (n=${y.total})`);
}

if (OUT_PATH) {
  const outAbs = path.resolve(ROOT, OUT_PATH);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`\nメトリクスを書き出しました: ${path.relative(ROOT, outAbs)}`);
}
