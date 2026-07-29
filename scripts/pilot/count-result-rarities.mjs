#!/usr/bin/env node
// scripts/pilot/count-result-rarities.mjs（使い捨てpilot）
//
// giant-killing milestone plan (docs/raw/2026-07-11-giant-killing-milestone-plan.md) P0:
// B系統3カテゴリ（perfect-title / title-streak-gap / first-region）の出現頻度を
// data/tournaments/details/**（全大会・全年度・全種目）を横断して事前検証する。
//
// 使い方: node scripts/pilot/count-result-rarities.mjs [--json]

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DETAILS_DIR = path.join(ROOT, 'data', 'tournaments', 'details');

function normalizeKeyPart(s) {
  return String(s).replace(/\s+/g, '').normalize('NFKC');
}

function playerKey(name, team) {
  const base = team ? `${name}@${team}` : name;
  return normalizeKeyPart(base);
}

function resolveEntry(entry, participantById) {
  const players = [];
  const playerKeys = [];
  const teams = [];
  const prefectures = [];
  for (const id of entry.playerIds ?? []) {
    const p = participantById.get(id);
    if (!p) {
      players.push(id);
      playerKeys.push(playerKey(id));
      continue;
    }
    const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
    if (name) {
      players.push(name);
      playerKeys.push(playerKey(name, p.team));
    }
    if (p.team && !teams.includes(p.team)) teams.push(p.team);
    if (p.prefecture && !prefectures.includes(p.prefecture)) prefectures.push(p.prefecture);
  }
  const nameStr = players.join('・');
  const display = nameStr ? (teams.length > 0 ? `${nameStr}（${teams.join('・')}）` : nameStr) : teams.join('・');
  return { display: display || null, players, playerKeys, teams, prefectures };
}

// ---- ディレクトリ走査 ----
// data/tournaments/details/<tournamentId>/<year>/<categoryId>.json のみ対象。
// <year>/temp/** は作業中の中間データ（不完全なJSON構造）のため除外する。

const tournamentIds = fs
  .readdirSync(DETAILS_DIR)
  .filter((name) => fs.statSync(path.join(DETAILS_DIR, name)).isDirectory());

// categoryTimeline: key=`${tournamentId}::${categoryId}` -> { years: number[] (held editions, asc),
//   champions: Map<year, ChampionInfo|null> }
const categoryTimeline = new Map();

let totalFilesScanned = 0;
let totalYearsWithKnownChampion = 0;
const perfectTitleEvents = [];
const perfectTitleUnknown = []; // 判定不能（matches突合失敗等）
const titleStreakGapEvents = [];
const firstRegionEvents = [];

for (const tournamentId of tournamentIds) {
  const tDir = path.join(DETAILS_DIR, tournamentId);
  const yearDirs = fs
    .readdirSync(tDir)
    .filter((name) => /^\d{4}$/.test(name))
    .sort((a, b) => Number(a) - Number(b));

  for (const yearStr of yearDirs) {
    const year = Number(yearStr);
    const yDir = path.join(tDir, yearStr);
    const files = fs.readdirSync(yDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const categoryId = file.replace(/\.json$/, '');
      const filePath = path.join(yDir, file);
      totalFilesScanned += 1;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        continue;
      }
      if (Array.isArray(data)) continue; // temp形式の混入ガード

      const key = `${tournamentId}::${categoryId}`;
      if (!categoryTimeline.has(key)) categoryTimeline.set(key, { years: [], champions: new Map() });
      const timeline = categoryTimeline.get(key);
      timeline.years.push(year);

      const participantById = new Map((data.participants ?? []).map((p) => [p.id, p]));
      const entryByNo = new Map((data.entries ?? []).map((e) => [e.entryNo, e]));

      const winnerResult = (data.results ?? []).find((r) => r.tournament?.rank?.kind === 'winner');
      if (!winnerResult) {
        timeline.champions.set(year, null);
        continue;
      }
      const championEntryNo = winnerResult.entryNo;
      const entry = entryByNo.get(championEntryNo);
      if (!entry) {
        timeline.champions.set(year, null);
        continue;
      }
      const resolved = resolveEntry(entry, participantById);
      if (!resolved.display) {
        timeline.champions.set(year, null);
        continue;
      }

      // --- perfect-title 判定: 優勝者が絡んだ全試合で相手のゲーム獲得数が0 ---
      const champMatches = (data.matches ?? []).filter((m) => Array.isArray(m.entries) && m.entries.includes(championEntryNo));
      let perfect = null; // true/false/null(判定不能)
      let retiredInvolved = false;
      if (champMatches.length === 0) {
        perfect = null; // bye続きで試合が無い等
      } else {
        let allWon = true;
        let allZeroConceded = true;
        for (const m of champMatches) {
          if (m.retired) retiredInvolved = true;
          if (m.winnerEntryNo !== championEntryNo) {
            allWon = false;
            continue;
          }
          const opponentEntryNo = m.entries.find((e) => e !== championEntryNo);
          const opponentScore = m.scores?.[String(opponentEntryNo)];
          if (typeof opponentScore !== 'number' || opponentScore !== 0) allZeroConceded = false;
        }
        perfect = allWon && allZeroConceded;
      }

      const championInfo = {
        year,
        entryNo: championEntryNo,
        display: resolved.display,
        players: resolved.players,
        playerKeys: resolved.playerKeys,
        teams: resolved.teams,
        prefectures: resolved.prefectures,
      };
      timeline.champions.set(year, championInfo);
      totalYearsWithKnownChampion += 1;

      if (perfect === true) {
        perfectTitleEvents.push({
          tournamentId,
          categoryId,
          year,
          champion: resolved.display,
          matches: champMatches.length,
          retiredInvolved,
        });
      } else if (perfect === null) {
        perfectTitleUnknown.push({ tournamentId, categoryId, year, champion: resolved.display, reason: 'no-matches-found' });
      }
    }
  }
}

// ---- title-streak-gap / first-region: タイムラインを走査 ----
// subjectHistory: key=`${tournamentId}::${categoryId}::${subjectKey}` -> won years asc
const subjectHistory = new Map();
// prefectureSeen: key=`${tournamentId}::${categoryId}` -> Set<prefecture>
const prefectureSeen = new Map();

for (const [key, timeline] of categoryTimeline.entries()) {
  const [tournamentId, categoryId] = key.split('::');
  const editionYears = timeline.years.slice().sort((a, b) => a - b);
  const seenPref = new Set();
  prefectureSeen.set(key, seenPref);

  let hadPriorKnownChampion = false;

  for (const year of editionYears) {
    const champ = timeline.champions.get(year);
    if (!champ) continue;

    // --- first-region候補: 過去に登場したことのない都道府県からの優勝 ---
    if (hadPriorKnownChampion) {
      const newPrefs = champ.prefectures.filter((p) => p && !seenPref.has(p));
      // 全所属都道府県が新規（ペア分割等で一方だけ新規のケースは低確度として別集計）
      if (newPrefs.length > 0) {
        const allNew = newPrefs.length === champ.prefectures.length && champ.prefectures.length > 0;
        firstRegionEvents.push({
          tournamentId,
          categoryId,
          year,
          champion: champ.display,
          newPrefectures: newPrefs,
          confidence: allNew ? 'high' : 'mixed-pair-low',
        });
      }
    }
    champ.prefectures.forEach((p) => p && seenPref.add(p));
    hadPriorKnownChampion = true;

    // --- title-streak-gap: subject（個人 or 団体）単位の再優勝ギャップ検出 ---
    const subjects = champ.players.length > 0 ? champ.playerKeys.map((pk, i) => ({ key: pk, label: champ.players[i] })) : [{ key: normalizeKeyPart(champ.teams.join('|')), label: champ.display }];

    for (const subj of subjects) {
      if (!subj.key) continue;
      const subjKey = `${key}::${subj.key}`;
      const history = subjectHistory.get(subjKey) ?? [];
      if (history.length > 0) {
        const lastYear = history[history.length - 1];
        const idxCurrent = editionYears.indexOf(year);
        const idxLast = editionYears.indexOf(lastYear);
        const isImmediatePrevEdition = idxCurrent - idxLast === 1;
        if (!isImmediatePrevEdition) {
          titleStreakGapEvents.push({
            tournamentId,
            categoryId,
            year,
            subject: subj.label,
            n: history.length + 1,
            gapYears: year - lastYear,
            gapEditions: idxCurrent - idxLast,
            previousTitleYear: lastYear,
          });
        }
      }
      subjectHistory.set(subjKey, [...history, year]);
    }
  }
}

// ---- レポート出力 ----

const summary = {
  totalCategoryFilesScanned: totalFilesScanned,
  totalCategoryEditions: [...categoryTimeline.values()].reduce((acc, t) => acc + t.years.length, 0),
  totalEditionsWithKnownChampion: totalYearsWithKnownChampion,
  perfectTitle: {
    count: perfectTitleEvents.length,
    countWithRetiredInvolved: perfectTitleEvents.filter((e) => e.retiredInvolved).length,
    unknownCount: perfectTitleUnknown.length,
    rate: totalYearsWithKnownChampion ? (perfectTitleEvents.length / totalYearsWithKnownChampion) : 0,
  },
  titleStreakGap: {
    count: titleStreakGapEvents.length,
    gapYearsDistribution: titleStreakGapEvents.reduce((acc, e) => {
      acc[e.gapYears] = (acc[e.gapYears] ?? 0) + 1;
      return acc;
    }, {}),
  },
  firstRegion: {
    count: firstRegionEvents.length,
    highConfidenceCount: firstRegionEvents.filter((e) => e.confidence === 'high').length,
    mixedLowConfidenceCount: firstRegionEvents.filter((e) => e.confidence === 'mixed-pair-low').length,
  },
};

const args = process.argv.slice(2);
if (args.includes('--json')) {
  console.log(
    JSON.stringify(
      { summary, perfectTitleEvents, perfectTitleUnknown, titleStreakGapEvents, firstRegionEvents },
      null,
      2,
    ),
  );
} else {
  console.log('=== サマリー ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n=== perfect-title（無敗優勝）サンプル 上位15件 ===');
  console.log(JSON.stringify(perfectTitleEvents.slice(0, 15), null, 2));
  console.log('\n=== perfect-title 判定不能サンプル 上位10件 ===');
  console.log(JSON.stringify(perfectTitleUnknown.slice(0, 10), null, 2));
  console.log('\n=== title-streak-gap（◯年ぶりN回目）サンプル 上位15件 ===');
  console.log(JSON.stringify(titleStreakGapEvents.slice(0, 15), null, 2));
  console.log('\n=== first-region（地域初優勝候補）サンプル 上位15件（high confidenceのみ） ===');
  console.log(JSON.stringify(firstRegionEvents.filter((e) => e.confidence === 'high').slice(0, 15), null, 2));
  console.log('\n=== first-region mixed-pair-low サンプル 上位10件 ===');
  console.log(JSON.stringify(firstRegionEvents.filter((e) => e.confidence !== 'high').slice(0, 10), null, 2));
}
