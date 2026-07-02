// lib/playerStats/placement.ts
// placement 正規化・roundOrder 正規化・categoryId パース（データ契約 §B, §C, §G）。
// 純粋関数のみ（副作用なし）。

import type { Discipline, Gender, Placement } from './types';

/** results[].tournament.rank と roundrobin から Placement を解決する（§C）。 */
export function resolvePlacement(result: {
  tournament?: { rank?: { kind?: string; bestLevel?: number; round?: number } } | null;
  roundrobin?: { group?: string; rank?: number } | null;
}): Placement {
  const rk = result.tournament?.rank;
  if (rk?.kind === 'winner') return { kind: 'winner' };
  if (rk?.kind === 'runnerup') return { kind: 'runnerup' };
  if (rk?.kind === 'best') {
    const level = rk.bestLevel === 4 ? 4 : 8;
    return { kind: 'best', bestLevel: level };
  }
  if (rk?.kind === 'round' && typeof rk.round === 'number') {
    return { kind: 'roundLoss', round: rk.round };
  }
  if (result.roundrobin && typeof result.roundrobin.rank === 'number') {
    return { kind: 'groupOnly', groupRank: result.roundrobin.rank };
  }
  return { kind: 'unknown' };
}

/** placement.kind==='winner' か（優勝判定）。 */
export function isWinner(p: Placement): boolean {
  return p.kind === 'winner';
}

const ROUND_LITERAL_ORDER: Record<string, number> = {
  準々決勝: 100,
  準決勝: 101,
  決勝: 102,
};

/**
 * round 名を単調増加へ写像（同日内順序に使う。§G）。
 * 「N回戦」→ N / 準々決勝 < 準決勝 < 決勝。不明・リーグは 0。
 */
export function normalizeRoundOrder(round: string | null | undefined): number {
  if (!round) return 0;
  const literal = ROUND_LITERAL_ORDER[round];
  if (literal !== undefined) return literal;
  const m = round.match(/^(\d+)回戦$/);
  if (m) return Number(m[1]);
  return 0;
}

/** 決勝ラウンドか（進出率判定用）。 */
export function isFinalRound(round: string | null | undefined): boolean {
  return round === '決勝';
}

/** 準決勝ラウンドか（進出率判定用）。 */
export function isSemifinalRound(round: string | null | undefined): boolean {
  return round === '準決勝';
}

export interface ParsedCategory {
  categoryId: string;
  /** 種目トークン（mixed は gender 由来）。 */
  category: Discipline;
  /** 生の disc セグメント（singles/doubles/team）。 */
  disc: string;
  gender: Gender;
  /** 年齢は生文字列で保持のみ。 */
  ageRaw: string;
}

/**
 * categoryId（`{disc}-{age}-{gender}`）をパース（§B）。
 * disc はハイフンを含まない実測前提だが、age がハイフンを含む可能性に配慮し
 * 末尾 2 セグメント（age, gender）を pop、残りを disc とする。
 */
export function parseCategoryId(fileNameOrId: string): ParsedCategory | null {
  const base = fileNameOrId.replace(/\.json$/, '');
  const parts = base.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const disc = parts.join('-');
  const genderToken: Gender = gender === 'boys' ? 'boys' : gender === 'girls' ? 'girls' : 'mixed';
  const category: Discipline = gender === 'mixed' ? 'mixed' : disc === 'singles' ? 'singles' : disc === 'doubles' ? 'doubles' : 'team';
  return {
    categoryId: `${disc}-${age}-${gender}`,
    category,
    disc,
    gender: genderToken,
    ageRaw: age,
  };
}
