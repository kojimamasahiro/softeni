// lib/bracketLayout.server.ts
// ファイル読み込みを伴うブラケット復元。**サーバ専用**（`fs` を使う）。
//
// 純粋な計算は lib/bracketLayout.ts にある。あちらはブラウザ（TournamentBracket）からも
// 読まれるので、`fs` に触る処理をこちらへ分離している。

import { buildBracketLayout, type BracketLayout } from './bracketLayout';
import { readYearDetail } from './tournamentRecords';

/** 大会・年度・種目からレイアウトを作る（薄いキャッシュ付き）。 */
const layoutCache = new Map<string, BracketLayout | null>();

export function getBracketLayout(tournamentId: string, year: number, categoryId: string): BracketLayout | null {
  const key = `${tournamentId}/${year}/${categoryId}`;
  if (layoutCache.has(key)) return layoutCache.get(key) ?? null;
  const layout = buildBracketLayout(readYearDetail(tournamentId, year, categoryId));
  layoutCache.set(key, layout);
  return layout;
}
