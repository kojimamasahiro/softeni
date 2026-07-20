// lib/playerStats/aggregators/majorResults.ts
// 主要大会のカテゴリ別ベスト8以上（勲章カード用）。
//
// 対象（2026-07-20 ユーザー決定）:
// - 成績: **ベスト8以上**（優勝 / 準優勝 / ベスト4 / ベスト8）。それ未満は出さない。
// - 大会: `lib/nationalTitles.ts` で `majorCategory !== null` のもの。
//   社会人（`corporate`）・東日本/西日本選手権・国際予選（`international-qualifier`）は対象外。
// - カテゴリ: ジュニア / 高校 / 大学 / 総合 / 国際大会 / シニア の 6 つ。
//   記録が無いカテゴリは要素ごと返さない（＝カードが出ない）。これは許容仕様。
//
// 「全国大会優勝」（`aggregateTitles` の `titles.national`）とは対象集合が違う。
// 社会人を含むか・国際大会を含むかが逆になっているので、片方を直すときはもう片方も確認すること。
// 対応表は lib/nationalTitles.ts の冒頭コメントにある。

import type { MajorCategoryResult, MajorResultEntry } from '../../../src/types/playerStatistics';
import { getNationalTitleMeta, MAJOR_CATEGORY_LABEL, MAJOR_CATEGORY_ORDER, type MajorCategoryId } from '../../nationalTitles';
import type { Placement, PlayerFacts } from '../types';
import { disciplineGenderLabel } from './util';

/** ベスト8以上なら {rank, label} を返す。それ未満・不明は null（＝対象外）。 */
function classifyPlacement(p: Placement): { rank: 1 | 2 | 4 | 8; label: string } | null {
  if (p.kind === 'winner') return { rank: 1, label: '優勝' };
  if (p.kind === 'runnerup') return { rank: 2, label: '準優勝' };
  if (p.kind === 'best') return p.bestLevel === 4 ? { rank: 4, label: 'ベスト4' } : { rank: 8, label: 'ベスト8' };
  return null;
}

export function aggregateMajorResults(facts: PlayerFacts): MajorCategoryResult[] {
  const byCategory = new Map<MajorCategoryId, MajorResultEntry[]>();

  for (const e of facts.entries) {
    const meta = getNationalTitleMeta(e.tournamentId);
    if (!meta || !meta.majorCategory) continue;
    const classified = classifyPlacement(e.placement);
    if (!classified) continue;

    const list = byCategory.get(meta.majorCategory) ?? [];
    list.push({
      tournamentId: e.tournamentId,
      tournamentName: meta.label,
      shortLabel: meta.shortLabel,
      categoryId: e.categoryId,
      discipline: disciplineGenderLabel(e.categoryId),
      year: e.year,
      date: e.date || null,
      placementLabel: classified.label,
      placementRank: classified.rank,
    });
    byCategory.set(meta.majorCategory, list);
  }

  const out: MajorCategoryResult[] = [];
  // カテゴリの並びはキャリア進行順に固定（成績の良し悪しで並べ替えない）。
  for (const category of MAJOR_CATEGORY_ORDER) {
    const entries = byCategory.get(category);
    if (!entries || entries.length === 0) continue;
    // 成績上位順 → 同順位なら年度降順（直近優先）。best は先頭。
    entries.sort((a, b) => a.placementRank - b.placementRank || b.year - a.year || (b.date ?? '').localeCompare(a.date ?? ''));
    out.push({
      category,
      categoryLabel: MAJOR_CATEGORY_LABEL[category],
      best: entries[0],
      entries,
    });
  }
  return out;
}
