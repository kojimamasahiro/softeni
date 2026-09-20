// lib/categoryFormat.ts
//
// 種目別の競技方式（information の `categories[].format`）を表示用に整える純関数。
//
// 目的（docs/adr/ADR-021）:
// 主催者が方式を文章で公開していない大会がある。アジア競技大会2026の公式リザルトサイトは
// Schedule / Groups / Brackets の3画面を突き合わせないと形式が分からず、
// 「何組が予選を通過するのか」「なぜ1回戦が4試合しか無いのか」が読み取れない。
// 当サイトがその1ブロックを引き受ける。
//
// 方式は**出典の転記＋当サイトの推定**が混ざる。そのため
// 出典（`source` / `sourceUrl`）が無ければ表示せず、推定（`assumptions`）は
// 「当サイトの推定」と明示して分けて返す。schedule と同じ規約。

import type { TournamentCategoryInfo, TournamentInformationEntry } from '@/types/tournament';

export type CategoryFormat = {
  summary: string;
  /** 出典から決まらず当サイトが推定した点。無ければ空配列 */
  assumptions: string[];
  source: string;
  sourceUrl: string;
  checkedOn: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * その種目の競技方式を返す。`summary` か出典が欠けていれば null（＝何も表示しない）。
 */
export function buildCategoryFormat(category: TournamentCategoryInfo | null | undefined): CategoryFormat | null {
  const f = category?.format;
  if (!f) return null;

  const summary = f.summary?.trim();
  const source = f.source?.trim();
  const sourceUrl = f.sourceUrl?.trim();
  // 出典を併記できないものは出さない（推測と転記の区別が付かなくなるため）
  if (!summary || !source || !sourceUrl) return null;

  return {
    summary,
    assumptions: (f.assumptions ?? []).map((a) => a.trim()).filter(Boolean),
    source,
    sourceUrl,
    checkedOn: f.checkedOn && DATE_RE.test(f.checkedOn) ? f.checkedOn : null,
  };
}

/** 年度レコードと categoryId から引く版。ページ側はこちらを使う。 */
export function findCategoryFormat(edition: TournamentInformationEntry | null | undefined, categoryId: string): CategoryFormat | null {
  return buildCategoryFormat((edition?.categories ?? []).find((c) => c.categoryId === categoryId));
}

/** `2026-09-19` -> `2026年9月19日` */
export function formatCheckedOn(checkedOn: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(checkedOn);
  if (!m) return checkedOn;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}
