// lib/highschoolRanking.ts
// 高校ソフトテニス 強豪校ランキングの集計ロジック。
// データソースは data/highschool/prefectures/*/summary.json(学校×大会×年度×種目の成績行)。
// 対象は高校主要大会のうち収録済みの3大会(国体は未収録のため対象外。lib/highschool.ts の
// TOURNAMENT_PRIORITY 参照)。配点・重みは独自集計であり、公式ランキングではない。
//
// Assumption(2026-07-17): 配点(優勝10/準優勝6/ベスト4 4/ベスト8 2/出場0.5)、
// 年度重み(直近から 1.0/0.8/0.6、それ以前 0.3)、団体×2 は運用判断の初期値。
// 採否・調整は docs/raw/2026-07-17-idea-highschool-strong-school-ranking.md を参照。

import fs from 'fs';
import path from 'path';

/** ランキング対象の大会(収録済みの高校全国大会のみ。国体はデータ未収録) */
export const RANKING_TOURNAMENTS: Record<string, string> = {
  'highschool-championship': 'インターハイ',
  'highschool-japan-cup': 'ハイスクールジャパンカップ',
  'highschool-senbatsu': '全日本高校選抜',
};

/** 成績ラベル→基礎点。表にない結果(◯回戦敗退・予選敗退など)は出場点。 */
export const RESULT_POINTS: Record<string, number> = {
  優勝: 10,
  準優勝: 6,
  ベスト4: 4,
  ベスト8: 2,
};
export const PARTICIPATION_POINTS = 0.5;

/** 種目係数: 団体戦を「強豪校」の主指標として重くする。 */
export const CATEGORY_WEIGHT: Record<string, number> = {
  team: 2,
  doubles: 1,
  singles: 1,
};

/** 年度重み: 最新年度から 1.0 / 0.8 / 0.6、それ以前は 0.3。 */
export function yearWeight(year: number, latestYear: number): number {
  const diff = latestYear - year;
  if (diff <= 0) return 1.0;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.6;
  return 0.3;
}

type SummaryRow = {
  team: string;
  teamId: string;
  prefecture: string;
  prefectureId: string;
  result: string;
  category: string;
  tournamentId: string;
  year: number;
  gender: string;
};

export type SchoolRankEntry = {
  rank: number;
  team: string;
  teamId: string;
  prefecture: string;
  prefectureId: string;
  gender: string;
  /** 小数1桁に丸めた合計ポイント */
  points: number;
  /** 上位成績の内訳(重み適用前の件数) */
  winner: number;
  runnerup: number;
  best4: number;
  best8: number;
  /** 対象大会への掲載行数(出場規模の目安) */
  appearances: number;
};

export type SchoolRankingBoard = {
  gender: string;
  latestYear: number;
  /** 集計対象の年度範囲 */
  minYear: number;
  maxYear: number;
  /** 掲載学校数(=ポイントを持つ学校数) */
  outOf: number;
  entries: SchoolRankEntry[];
};

function loadRows(root: string): SummaryRow[] {
  const base = path.join(root, 'data', 'highschool', 'prefectures');
  const rows: SummaryRow[] = [];
  let prefDirs: string[] = [];
  try {
    prefDirs = fs.readdirSync(base);
  } catch {
    return rows;
  }
  for (const pref of prefDirs) {
    const file = path.join(base, pref, 'summary.json');
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as SummaryRow[];
      for (const r of data) {
        if (RANKING_TOURNAMENTS[r.tournamentId] && r.teamId && r.prefectureId) rows.push(r);
      }
    } catch {
      // summary.json が無い県はスキップ
    }
  }
  return rows;
}

/** 全国版の強豪校ランキングを男女別に集計する。 */
export function buildSchoolRankingBoards(root: string, topN = 100): SchoolRankingBoard[] {
  const rows = loadRows(root);
  if (rows.length === 0) return [];
  const latestYear = Math.max(...rows.map((r) => r.year));
  const minYear = Math.min(...rows.map((r) => r.year));

  const boards: SchoolRankingBoard[] = [];
  for (const gender of ['boys', 'girls']) {
    const byTeam = new Map<string, Omit<SchoolRankEntry, 'rank' | 'points'> & { raw: number }>();
    for (const r of rows) {
      if (r.gender !== gender) continue;
      const base = RESULT_POINTS[r.result] ?? PARTICIPATION_POINTS;
      const pts = base * (CATEGORY_WEIGHT[r.category] ?? 1) * yearWeight(r.year, latestYear);
      let e = byTeam.get(r.teamId);
      if (!e) {
        e = {
          team: r.team,
          teamId: r.teamId,
          prefecture: r.prefecture,
          prefectureId: r.prefectureId,
          gender,
          winner: 0,
          runnerup: 0,
          best4: 0,
          best8: 0,
          appearances: 0,
          raw: 0,
        };
        byTeam.set(r.teamId, e);
      }
      e.raw += pts;
      e.appearances += 1;
      if (r.result === '優勝') e.winner += 1;
      else if (r.result === '準優勝') e.runnerup += 1;
      else if (r.result === 'ベスト4') e.best4 += 1;
      else if (r.result === 'ベスト8') e.best8 += 1;
    }

    const sorted = [...byTeam.values()].sort(
      (a, b) => b.raw - a.raw || b.winner - a.winner || b.runnerup - a.runnerup || b.best4 - a.best4 || b.best8 - a.best8 || a.team.localeCompare(b.team, 'ja'),
    );
    const entries: SchoolRankEntry[] = [];
    let prevPoints: number | null = null;
    let prevRank = 0;
    sorted.slice(0, topN).forEach((e, i) => {
      const points = Math.round(e.raw * 10) / 10;
      // 同点は同順位(丸め後のポイントで判定)
      const rank = points === prevPoints ? prevRank : i + 1;
      prevPoints = points;
      prevRank = rank;
      entries.push({
        rank,
        points,
        team: e.team,
        teamId: e.teamId,
        prefecture: e.prefecture,
        prefectureId: e.prefectureId,
        gender: e.gender,
        winner: e.winner,
        runnerup: e.runnerup,
        best4: e.best4,
        best8: e.best8,
        appearances: e.appearances,
      });
    });
    boards.push({ gender, latestYear, minYear, maxYear: latestYear, outOf: byTeam.size, entries });
  }
  return boards;
}
