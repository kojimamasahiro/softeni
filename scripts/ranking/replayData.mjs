// scripts/ranking/replayData.mjs
// 大会結果（data/tournaments/details/**）を時系列の試合列として抽出する共通モジュール。
// 利用元: backtest.mjs（較正ハーネス）、generate-ratings.mjs（Elo副指標の生成）。
//
// - 時系列: 年 → 開催日（information/** の startDate。無い大会は年内末尾）→ 大会 → ファイル →
//   ブラケット深度（prevMatchIds のトポロジカル順）。先読みなしのリプレイに使える。
// - 本 config（data/ranking-config.json）の tierOverrides / excludeTournaments を常時ミラーする。
// - 名前ベース同定（同姓同名の融合を許容 = プロジェクト既定方針）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** results[].tournament.rank → 順位係数キー（lib/playerStats/placement.ts のミラー）。 */
export const coefKeyOf = (result) => {
  const rk = result?.tournament?.rank;
  if (rk?.kind === 'winner') return 'winner';
  if (rk?.kind === 'runnerup') return 'runnerup';
  if (rk?.kind === 'best') return rk.bestLevel === 4 ? 'best4' : 'best8';
  return 'entry'; // roundLoss / groupOnly / unknown はすべて entry 係数
};

/**
 * 大会結果を読み込み、時系列ソート済みの試合列と各種マスタを返す。
 *
 * options:
 *   excludeGenerationInternational: generationId='international' を追加で除外（既定 false。
 *     config の excludeTournaments は常に除外）
 *   retierMap: Map<tid, tier> 実験用の tier 上書き（config の tierOverrides より優先）
 *   collectPlacements: results から placement 行を収集する（既定 false）
 */
export function buildReplay(options = {}) {
  const { excludeGenerationInternational = false, retierMap = null, collectPlacements = false } = options;

  const rankingConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ranking-config.json'), 'utf-8'));

  // Elo K 用の tier: isMajorTitle → major / index.json 掲載 → national / 非掲載 → local。
  // Assumption: generationId が international 系も national の K で扱う（専用 tier が無いため）。
  const tierForElo = new Map();
  // ポイント式用の tier（本エンジン resolveTier のミラー: 国際系 → local）
  const tierForPointsBase = new Map();
  const trueInternational = new Set();
  {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tournaments', 'index.json'), 'utf-8'));
    const list = Array.isArray(idx) ? idx : idx.tournaments;
    for (const t of list) {
      const gen = t.generationId ?? '';
      if (gen === 'international') trueInternational.add(t.tournamentId);
      tierForElo.set(t.tournamentId, t.isMajorTitle ? 'major' : 'national');
      tierForPointsBase.set(t.tournamentId, t.isMajorTitle ? 'major' : gen.startsWith('international') ? 'local' : 'national');
    }
  }

  const configTierOverrides = new Map(
    Object.entries(rankingConfig.ranking.tierOverrides ?? {}).filter(
      ([k, v]) => !k.startsWith('_') && ['major', 'national', 'local'].includes(v),
    ),
  );
  const configExcluded = new Set(rankingConfig.ranking.excludeTournaments ?? []);

  const tierOfElo = (tid) => tierForElo.get(tid) ?? 'local';
  const tierOfPoints = (tid) => {
    if (retierMap && retierMap.has(tid)) return retierMap.get(tid);
    if (configTierOverrides.has(tid)) return configTierOverrides.get(tid);
    return tierForPointsBase.get(tid) ?? 'local';
  };

  // 開催日: information/{tournamentId}.json の年度別 startDate
  const dateByTidYear = new Map();
  {
    const infoDir = path.join(ROOT, 'data', 'tournaments', 'information');
    for (const f of fs.readdirSync(infoDir)) {
      if (!f.endsWith('.json')) continue;
      const tid = f.replace(/\.json$/, '');
      let rows;
      try {
        rows = JSON.parse(fs.readFileSync(path.join(infoDir, f), 'utf-8'));
      } catch {
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const r of rows) {
        if (r && r.year && r.startDate) dateByTidYear.set(`${tid}\t${r.year}`, r.startDate);
      }
    }
  }

  // 同姓同名リスト
  const homonymNames = new Set();
  {
    const p = path.join(ROOT, 'data', 'players', 'homonyms.json');
    if (fs.existsSync(p)) {
      for (const h of JSON.parse(fs.readFileSync(p, 'utf-8'))) {
        homonymNames.add(`${h.lastName ?? ''}${h.firstName ?? ''}`);
      }
    }
  }

  // ---------- 対戦データ抽出 ----------
  const detailsDir = path.join(ROOT, 'data', 'tournaments', 'details');
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) files.push(p);
    }
  })(detailsDir);
  files.sort();

  const skipped = {};
  const skip = (k) => {
    skipped[k] = (skipped[k] ?? 0) + 1;
  };
  const matches = []; // { sortKey, year, tid, discipline, gender, sideA, sideB, winner, retired }
  const placements = []; // { name, year, tid, discipline, gender, tier, coefKey }

  for (const file of files) {
    const rel = path.relative(detailsDir, file);
    const mPath = /^([^/\\]+)[/\\](\d{4})[/\\]/.exec(rel);
    if (!mPath) {
      skip('no-year-path');
      continue;
    }
    const [, tid, yearStr] = mPath;
    if (configExcluded.has(tid) || (excludeGenerationInternational && trueInternational.has(tid))) {
      skip('excluded-international');
      continue;
    }
    const year = Number(yearStr);
    const base = path.basename(file, '.json');
    const mCat = /^(singles|doubles|team)-(.+)-(boys|girls|mixed)$/.exec(base);
    const discipline = mCat ? mCat[1] : null;
    const gender = mCat ? mCat[3] : null;

    let d;
    try {
      d = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      skip('parse-error');
      continue;
    }
    if (!d || Array.isArray(d) || typeof d !== 'object') {
      skip('non-dict-top');
      continue;
    }

    const nameById = new Map();
    for (const p of d.participants ?? []) {
      if (!p || p.id === undefined) continue;
      const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
      if (name) nameById.set(p.id, name);
    }
    const playersByEntry = new Map();
    for (const e of d.entries ?? []) {
      if (!e || e.entryNo === undefined) continue;
      playersByEntry.set(e.entryNo, e.playerIds ?? []);
    }

    const list = d.matches ?? [];
    const byId = new Map();
    for (const mt of list) if (mt && mt.matchId) byId.set(mt.matchId, mt);
    const depthCache = new Map();
    const depthOf = (mid, seen = new Set()) => {
      if (depthCache.has(mid)) return depthCache.get(mid);
      const mt = byId.get(mid);
      if (!mt || seen.has(mid)) return 0;
      seen.add(mid);
      const prevs = (mt.prevMatchIds ?? []).filter(Boolean);
      if (mt.prevMatchId) prevs.push(mt.prevMatchId);
      const dv = prevs.length === 0 ? 0 : 1 + Math.max(...prevs.map((p) => depthOf(p, seen)));
      depthCache.set(mid, dv);
      return dv;
    };

    if (collectPlacements && (discipline === 'singles' || discipline === 'doubles') && (gender === 'boys' || gender === 'girls')) {
      const tier = tierOfPoints(tid);
      for (const r of d.results ?? []) {
        if (!r || r.entryNo === undefined) continue;
        const coefKey = coefKeyOf(r);
        for (const id of playersByEntry.get(r.entryNo) ?? []) {
          const name = nameById.get(id);
          if (name) placements.push({ name, year, tid, discipline, gender, tier, coefKey });
        }
      }
    }

    const date = dateByTidYear.get(`${tid}\t${year}`) ?? '~'; // 日付なしは年内の最後に回す
    for (let i = 0; i < list.length; i++) {
      const mt = list[i];
      if (!mt || typeof mt !== 'object') continue;
      const ens = mt.entries;
      if (!ens || ens.length !== 2) {
        skip('entries-not-2');
        continue;
      }
      const w = mt.winnerEntryNo;
      if (w === undefined || w === null || !ens.includes(w)) {
        skip('no-winner');
        continue;
      }
      const sideA = (playersByEntry.get(ens[0]) ?? []).map((id) => nameById.get(id)).filter(Boolean);
      const sideB = (playersByEntry.get(ens[1]) ?? []).map((id) => nameById.get(id)).filter(Boolean);
      if (sideA.length === 0 || sideB.length === 0) {
        skip('no-player-names');
        continue;
      }
      const depth = mt.matchId ? depthOf(mt.matchId) : i;
      matches.push({
        sortKey: [year, date, tid, rel, depth],
        year,
        tid,
        discipline,
        gender,
        sideA,
        sideB,
        winner: w === ens[0] ? 0 : 1,
        retired: Boolean(mt.retired),
      });
    }
  }

  matches.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) {
      if (a.sortKey[i] < b.sortKey[i]) return -1;
      if (a.sortKey[i] > b.sortKey[i]) return 1;
    }
    return 0;
  });

  return {
    rankingConfig,
    matches,
    placements,
    files,
    skipped,
    dateByTidYear,
    homonymNames,
    trueInternational,
    tierOfElo,
    tierOfPoints,
    configTierOverrides,
    configExcluded,
  };
}

/** 生成済みポイントランキング（前年度スナップショット評価用）: `${year}\t${disc}\t${gender}` → Map(name → points) */
export function loadRankingsLookup() {
  const rankingsLookup = new Map();
  const dir = path.join(ROOT, 'data', 'rankings');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const m = /^(\d{4})-(singles|doubles)-(boys|girls)\.json$/.exec(f);
      if (!m) continue;
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const byName = new Map();
      for (const e of d.entries ?? []) {
        // 名前単位に丸める（同名は最大ポイント。homonym 融合は既定方針どおり許容）
        const prev = byName.get(e.playerName);
        if (prev === undefined || e.points > prev) byName.set(e.playerName, e.points);
      }
      rankingsLookup.set(`${d.year}\t${d.discipline}\t${d.gender}`, byName);
    }
  }
  return rankingsLookup;
}
