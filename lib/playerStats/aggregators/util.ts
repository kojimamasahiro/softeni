// lib/playerStats/aggregators/util.ts
// Aggregator 共通ユーティリティ（純粋関数）。
// - calculateRate: 既存 generate-player-analysis.mjs と同一の banker's rounding（表示互換）
// - placement ラベル / 順位比較
// - team-name-aliases 正準化

import fs from 'fs';
import path from 'path';

import type { GameTotals, WinLoss } from '../../../src/types/playerStatistics';
import { parseCategoryId } from '../placement';
import type { Placement, PlayerMatchFact } from '../types';

/** 種目トークンの日本語ラベル（lib/utils.getCategoryLabel と同義。依存を避け内包）。 */
export function categoryWord(disc: string): string {
  return disc === 'singles' ? 'シングルス' : disc === 'doubles' ? 'ダブルス' : '団体戦';
}

/** categoryId から「性別＋種目」ラベル（例: 男子ダブルス）。mixed は gender 由来。 */
export function disciplineGenderLabel(categoryId: string): string {
  const parsed = parseCategoryId(categoryId);
  if (!parsed) return categoryId;
  const genderLabel = parsed.gender === 'boys' ? '男子' : parsed.gender === 'girls' ? '女子' : '混合';
  const catLabel = parsed.category === 'mixed' ? 'ダブルス' : categoryWord(parsed.disc);
  return `${genderLabel}${catLabel}`;
}

/** 既存 analysis.json と一致する丸め（3 桁・偶数丸め）。 */
export function calculateRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  const factor = 1000;
  const scaled = numerator * factor;
  const quotient = Math.floor(scaled / denominator);
  const remainder = scaled % denominator;
  const doubled = remainder * 2;
  if (doubled < denominator) return quotient / factor;
  if (doubled > denominator) return (quotient + 1) / factor;
  return (quotient % 2 === 0 ? quotient : quotient + 1) / factor;
}

/** retired・draw を除いた実戦の勝敗を畳み込む。 */
export function foldWinLoss(matches: PlayerMatchFact[]): WinLoss {
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (!m.countsForWinRate) continue;
    if (m.result === 'win') wins += 1;
    else if (m.result === 'lose') losses += 1;
  }
  const total = wins + losses;
  return { total, wins, losses, winRate: calculateRate(wins, total) };
}

/** retired・draw を除いた実戦（決着した試合）のゲーム率を畳み込む。 */
export function foldGames(matches: PlayerMatchFact[]): GameTotals {
  let won = 0;
  let lost = 0;
  for (const m of matches) {
    if (!m.countsForWinRate) continue;
    if (m.result !== 'win' && m.result !== 'lose') continue; // draw 除外
    won += m.gamesWon;
    lost += m.gamesLost;
  }
  const total = won + lost;
  return { total, won, lost, gameRate: calculateRate(won, total) };
}

/** placement を強さ順（大きいほど上位）に写像。最高成績比較に使う。 */
export function placementRank(p: Placement): number {
  switch (p.kind) {
    case 'winner':
      return 1000;
    case 'runnerup':
      return 900;
    case 'best':
      return p.bestLevel === 4 ? 800 : 700;
    case 'roundLoss':
      return 100 + p.round; // 深いラウンドほど上位
    case 'groupOnly':
      return 10;
    default:
      return 0;
  }
}

/** placement の表示ラベル。 */
export function placementLabel(p: Placement): string {
  switch (p.kind) {
    case 'winner':
      return '優勝';
    case 'runnerup':
      return '準優勝';
    case 'best':
      return `ベスト${p.bestLevel}`;
    case 'roundLoss':
      return `${p.round}回戦`;
    case 'groupOnly':
      return `予選${p.groupRank}位`;
    default:
      return '';
  }
}

let aliasMap: Map<string, string> | null = null;

/** team-name-aliases.json から alias→canonical を構築（キャッシュ）。 */
export function loadTeamAliasMap(root?: string): Map<string, string> {
  if (aliasMap) return aliasMap;
  const cwd = root || process.cwd();
  const map = new Map<string, string>();
  try {
    const data = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'tournaments', 'team-name-aliases.json'), 'utf-8')) as {
      teamAliases?: Array<{ canonical: string; aliases: string[] }>;
    };
    for (const t of data.teamAliases ?? []) {
      for (const a of t.aliases ?? []) map.set(a, t.canonical);
    }
  } catch {
    // 無ければ空
  }
  aliasMap = map;
  return map;
}

export function __resetTeamAliasCache(): void {
  aliasMap = null;
  internationalTidSet = null;
}

/** 学校名を正準名へ寄せる（表記揺れ吸収）。null はそのまま。 */
export function canonicalizeTeam(team: string | null, root?: string): string | null {
  if (!team) return team;
  return loadTeamAliasMap(root).get(team) ?? team;
}

let internationalTidSet: Set<string> | null = null;

/**
 * index.json の `generationId === 'international'` な tournamentId 集合を構築（キャッシュ）。
 * 国際大会（コリアカップ等）では selfTeam が国別代表コード（例: JPN-1）で「所属」ではないため、
 * 所属集計から除外する判定に使う。
 * 国際予選（`international-qualifier`）は実クラブ所属で出場するため対象外（除外しない）。
 */
export function loadInternationalTournamentIds(root?: string): Set<string> {
  if (internationalTidSet) return internationalTidSet;
  const cwd = root || process.cwd();
  const set = new Set<string>();
  try {
    const data = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'tournaments', 'index.json'), 'utf-8')) as Array<{
      tournamentId?: string;
      generationId?: string | null;
    }>;
    for (const t of data) {
      if (t?.tournamentId && t.generationId === 'international') set.add(t.tournamentId);
    }
  } catch {
    // 無ければ空（除外なし）
  }
  internationalTidSet = set;
  return set;
}

/** その大会が国際大会（selfTeam が国別代表コード）か。所属集計の除外判定用。 */
export function isInternationalTournament(tournamentId: string, root?: string): boolean {
  return loadInternationalTournamentIds(root).has(tournamentId);
}
