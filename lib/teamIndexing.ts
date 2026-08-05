// チームページ（/teams/**）の noindex 選別。
//
// 背景: 選手結果ページで導入した「薄いページを noindex にしてインデックス枠を厚いページへ
// 集中させる」方針（docs/wiki/seo.md #2、PLAYER_INDEX_MIN_MATCHES）が、チームページには
// 未適用のままだった。2026-08-05 の実測では /teams/** 376枚のうち 274枚が可視テキスト
// 700字未満（ナビ＋数行）で、全て index かつ sitemap 掲載だった。
//
// 判定はページ側に置き、sitemap からの除外は postbuild の
// scripts/filter-noindex-from-sitemap.mjs が生成済み HTML の robots meta を見て自動追従する。
// 判定ロジックを二重に持たないため、この閾値を変えるだけで sitemap も追従する。
//
// 仕様: docs/wiki/seo.md「薄いチームページの noindex 選別」

import type { EventResult } from '@/utils/team-data-aggregator';

/**
 * index 対象とするために必要な最小の収録試合数。
 * 選手ページの 15 より小さいのは、チーム×年度×性別という粒度では
 * 母数がそもそも小さく、15 だとほぼ全滅するため（2026-08-05 決定）。
 */
export const TEAM_INDEX_MIN_MATCHES = 5;

/**
 * 収録試合数を数える。チーム所属選手が 1人でも出ている試合を 1 と数える
 * （ダブルスで両者が同一チームでも二重に数えない）。
 *
 * @param results 対象範囲の EventResult（年度別ページなら絞り込み後、ハブなら全件）
 * @param teamPlayerIds そのページで扱うチーム所属選手の pid 集合
 */
export function countTeamMatches(results: EventResult[], teamPlayerIds: Set<string>): number {
  let count = 0;
  for (const event of results) {
    for (const match of event.matches) {
      if (match.pair.some((pid) => teamPlayerIds.has(pid))) count += 1;
    }
  }
  return count;
}

/** 収録試合数が閾値以上なら index 対象。 */
export function shouldIndexTeamPage(matchCount: number): boolean {
  return matchCount >= TEAM_INDEX_MIN_MATCHES;
}
