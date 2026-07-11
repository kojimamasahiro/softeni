// lib/rareEventDiscovery.mjs
// 希少パターンの「発見」ハーネス。
// 決め打ちカテゴリ（RARE_EVENT_CONFIG.categories）の大小比較とは別に、
// 特徴量の組み合わせ（例: 決まり方×得点側×局面）から希少なパターンを探索する。
//
// ── 「条件を複雑にしただけ」問題への対処（本ハーネスの核） ──────────────────
// 条件を AND で重ねれば何でも「希少」になれる（717ポイントで3条件なら大抵0〜1件）。
// そこで各条件の周辺頻度から独立を仮定した**期待件数**を計算し、
//   - 期待件数が十分ある（minExpectedCount 以上）のに実測がずっと少ない（lift ≤ maxLift）
//     → 条件同士が反相関＝起きたら本物の希少 →「発見候補」
//   - 期待件数自体が小さい → 希少さは各条件の掛け算で説明できる →「複雑にしただけ」
// と分類する。maxLift / minExpectedCount / maxConditions が「複雑さをどこまで許容するか」の
// 調整ノブ。docs/wiki/rare-events.md 参照。
//
// 注意（データが小さいうちの限界）:
//  - n≈700 で多数の組み合わせを検定するため、偶然 lift が低く出るものが混ざる（多重比較）。
//    発見候補は必ず人がレビューし、納得できたものだけ RARE_EVENT_CONFIG.patterns に昇格する。
//  - 3条件の期待値は1条件の独立積で計算しており、2条件のサブパターンで説明できる場合がある。
//    レポートにサブパターンの lift を併記して人の判断材料にする。

import { FEATURE_LABELS, listPointsWithFeatures } from './rareEvents.mjs';

/**
 * 発見ハーネスの調整ノブ（「複雑さをどこまで許容するか」）。
 * - maxConditions: 組み合わせる条件数の上限。増やすほど探索は広がるが偶然合致も増える。
 * - maxCount: 実測がこれ以下のパターンを「希少」とみなす。
 * - minExpectedCount: 独立仮定の期待件数がこれ以上あるものだけ「発見候補」になれる
 *   （これ未満は「複雑にしただけ」判定）。上げるほど保守的。
 * - maxLift: 実測/期待 の上限（2条件時）。小さいほど「強い反相関」だけを拾う。
 * - liftTightenPerExtraCondition: 条件が1つ増えるごとに maxLift に掛ける倍率（<1で厳しく）。
 *   条件数に応じたペナルティ＝複雑さの価格。
 */
export const DISCOVERY_CONFIG = {
  maxConditions: 3,
  maxCount: 3,
  minExpectedCount: 3,
  maxLift: 0.5,
  liftTightenPerExtraCondition: 0.7,
  maxExamplesPerPattern: 3,
  maxReport: 15,
};

const comboKey = (atoms) =>
  atoms
    .map(([f, v]) => `${f}=${v}`)
    .sort()
    .join(' & ');

/** k条件パターンに許容する lift 上限（条件数ペナルティ込み）。 */
export const maxLiftFor = (k, config = DISCOVERY_CONFIG) => config.maxLift * Math.pow(config.liftTightenPerExtraCondition, Math.max(0, k - 2));

const combinations = (items, size) => {
  const result = [];
  const walk = (start, acc) => {
    if (acc.length === size) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i <= items.length - (size - acc.length); i++) {
      acc.push(items[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return result;
};

/**
 * 全試合のポイントから希少パターンを探索する。
 * 戻り値: {
 *   totalPoints,
 *   singles:     [{ atom, count, rate }]                      … 1条件で既に希少なもの（ベースライン）
 *   candidates:  [{ key, atoms, count, expected, lift, maxLiftAllowed, universe, examples, subPatterns }]
 *   justComplex: [{ key, atoms, count, expected, ... }]        … 希少だが独立積で説明できる（複雑にしただけ）
 * }
 */
export const discoverRarePatterns = (matches, config = DISCOVERY_CONFIG) => {
  const entries = [];
  for (const match of matches) entries.push(...listPointsWithFeatures(match));

  const featureNames = Object.keys(FEATURE_LABELS);

  // --- 1条件のベースライン（周辺頻度） ---
  const singles = [];
  const definedCount = new Map(); // feature -> 定義済みポイント数
  const valueCount = new Map(); // 'f=v' -> 件数
  for (const entry of entries) {
    for (const feature of featureNames) {
      const value = entry.features[feature];
      if (value === undefined) continue;
      definedCount.set(feature, (definedCount.get(feature) ?? 0) + 1);
      const key = `${feature}=${value}`;
      valueCount.set(key, (valueCount.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of valueCount) {
    const feature = key.split('=')[0];
    const universe = definedCount.get(feature) ?? 0;
    if (count <= config.maxCount && universe > 0) {
      singles.push({ atom: key, count, rate: count / universe, universe });
    }
  }
  singles.sort((a, b) => a.count - b.count || a.rate - b.rate);

  // --- 2〜maxConditions 条件の組み合わせ探索 ---
  const patternStats = new Map(); // comboKey -> stat（サブパターン参照用）
  const candidates = [];
  const justComplex = [];

  for (let k = 2; k <= config.maxConditions; k++) {
    for (const featureSet of combinations(featureNames, k)) {
      // この特徴量セットが全て定義されているポイントを分母（universe）にする
      const universe = entries.filter((e) => featureSet.every((f) => e.features[f] !== undefined));
      if (universe.length === 0) continue;

      // universe 内の周辺頻度
      const marginal = new Map(); // 'f=v' -> 件数
      const observed = new Map(); // comboKey -> エントリ配列
      for (const entry of universe) {
        for (const feature of featureSet) {
          const key = `${feature}=${entry.features[feature]}`;
          marginal.set(key, (marginal.get(key) ?? 0) + 1);
        }
        const atoms = featureSet.map((f) => [f, entry.features[f]]);
        const key = comboKey(atoms);
        if (!observed.has(key)) observed.set(key, { atoms, entries: [] });
        observed.get(key).entries.push(entry);
      }

      for (const [key, { atoms, entries: hits }] of observed) {
        const count = hits.length;
        // 独立仮定の期待件数 = N × Π P(atom)
        let expectedRate = 1;
        for (const [feature, value] of atoms) {
          expectedRate *= (marginal.get(`${feature}=${value}`) ?? 0) / universe.length;
        }
        const expected = expectedRate * universe.length;
        const lift = expected > 0 ? count / expected : Infinity;
        const stat = {
          key,
          atoms,
          count,
          universe: universe.length,
          expected,
          lift,
          maxLiftAllowed: maxLiftFor(atoms.length, config),
          examples: hits.slice(0, config.maxExamplesPerPattern),
        };
        patternStats.set(key, stat);

        if (count > config.maxCount) continue; // 希少ではない
        if (expected >= config.minExpectedCount && lift <= stat.maxLiftAllowed) {
          candidates.push(stat);
        } else {
          justComplex.push(stat);
        }
      }
    }
  }

  // 3条件以上の候補にサブパターン（k-1条件）の lift を併記し、サブパターン自体が
  // 既に希少判定を満たすなら「還元可能」（＝条件を1つ足しただけ）として候補から降格する。
  const irreducible = [];
  const reducible = [];
  for (const stat of candidates) {
    if (stat.atoms.length >= 3) {
      stat.subPatterns = combinations(stat.atoms, stat.atoms.length - 1)
        .map((subAtoms) => patternStats.get(comboKey(subAtoms)))
        .filter(Boolean)
        .map((sub) => ({ key: sub.key, count: sub.count, lift: sub.lift, atoms: sub.atoms }));
      // サブパターンが「希少（maxCount以下）かつ自分の条件数での許容lift以下」なら還元可能
      stat.reducibleTo = stat.subPatterns.filter((sub) => sub.count <= config.maxCount && sub.lift <= maxLiftFor(sub.atoms.length, config));
    }
    if (stat.reducibleTo?.length) reducible.push(stat);
    else irreducible.push(stat);
  }

  irreducible.sort((a, b) => a.lift - b.lift || a.count - b.count);
  reducible.sort((a, b) => a.lift - b.lift || a.count - b.count);
  justComplex.sort((a, b) => a.count - b.count || a.lift - b.lift);

  return {
    totalPoints: entries.length,
    singles,
    candidates: irreducible.slice(0, config.maxReport),
    reducible: reducible.slice(0, config.maxReport),
    justComplex: justComplex.slice(0, config.maxReport),
    candidateTotal: irreducible.length,
    reducibleTotal: reducible.length,
    justComplexTotal: justComplex.length,
  };
};

/** レポート表示用: 'result=smash_winner & winner_side=receive' → 日本語混じりの読みやすい表記 */
export const describeAtoms = (atoms) => atoms.map(([feature, value]) => `${FEATURE_LABELS[feature] ?? feature}=${value}`).join(' × ');
