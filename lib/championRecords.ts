// lib/championRecords.ts
// 大会の歴代ページに出す「記録」（種目別の最多優勝・最長連覇）。
//
// 「インターハイ 最多優勝」「全日本シングルス 連覇」のような記録系の検索語の受け皿
// （docs/raw/2026-09-22-idea-seo-expansion.md #3）。数え方（2026-09-22 ユーザー判断）:
// - **種目別に数える**（男子団体・女子ダブルス等を合算しない）。
// - 数えるのは**収録範囲の中だけ**。画面・FAQ でも「{収録範囲}の記録」と明記する。
// - 連覇は**収録のある連続した年**だけで数える。収録の無い年・中止の年をまたぐと途切れる。
// - 誰を1単位にするかは呼び出し側が holders で渡す:
//   高校全国大会は学校（個人戦も所属校。ペアが2校なら両校に1回ずつ）、
//   それ以外の大会は個人戦＝選手、団体戦＝チーム（toGenericRecordRows）。

import type { ChampionSummaryRow } from './highschoolNationalTournaments';

/** 記録の数え上げ単位。key で同一性を判定し、name を表示する（同姓同名を playerId で分けるため）。 */
export type RecordHolder = { key: string; name: string };
export type RecordRow = { categoryId: string; label: string; byYear: { year: number; holders: RecordHolder[] }[] };

export type HolderCount = { name: string; count: number; years: number[] };
export type HolderStreak = { name: string; length: number; from: number; to: number };

export type CategoryRecord = {
  categoryId: string;
  label: string;
  /** 優勝回数が最多（同数は全員）。最多が1回なら空（記録として意味が無い） */
  mostTitles: HolderCount[];
  /** 最長の連覇（同数は全件）。2連覇未満なら空 */
  longestStreaks: HolderStreak[];
};

export function computeChampionRecords(rows: RecordRow[]): CategoryRecord[] {
  const records: CategoryRecord[] = [];
  for (const row of rows) {
    const byYear = new Map<number, Set<string>>();
    const names = new Map<string, string>();
    for (const cell of row.byYear) {
      const keys = new Set<string>();
      for (const h of cell.holders) {
        if (!h.key || !h.name) continue;
        keys.add(h.key);
        names.set(h.key, h.name);
      }
      if (keys.size > 0) byYear.set(cell.year, keys);
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ja');

    const counts = new Map<string, number[]>();
    for (const [year, keys] of byYear) for (const k of keys) counts.set(k, [...(counts.get(k) ?? []), year]);
    const max = Math.max(0, ...[...counts.values()].map((y) => y.length));
    const mostTitles =
      max >= 2
        ? [...counts.entries()]
            .filter(([, y]) => y.length === max)
            .map(([k, y]) => ({ name: names.get(k)!, count: y.length, years: [...y].sort((a, b) => a - b) }))
            .sort(byName)
        : [];

    // 連覇: 前年に収録があり、かつ前年も優勝しているときだけ伸ばす。
    const streaks: HolderStreak[] = [];
    const running = new Map<string, { from: number; length: number }>();
    for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
      const keys = byYear.get(year)!;
      const prev = byYear.get(year - 1);
      for (const k of keys) {
        const cur = prev?.has(k) && running.has(k) ? running.get(k)! : { from: year, length: 0 };
        cur.length += 1;
        running.set(k, cur);
        streaks.push({ name: names.get(k)!, length: cur.length, from: cur.from, to: year });
      }
      for (const k of [...running.keys()]) if (!keys.has(k)) running.delete(k);
    }
    const best = Math.max(0, ...streaks.map((s) => s.length));
    const longestStreaks = best >= 2 ? streaks.filter((s) => s.length === best).sort((a, b) => a.from - b.from || byName(a, b)) : [];

    records.push({ categoryId: row.categoryId, label: row.label, mostTitles, longestStreaks });
  }
  return records.filter((r) => r.mostTitles.length > 0 || r.longestStreaks.length > 0);
}

/** 1種目ぶんの記録を1文にする（画面と FAQ で同じ文面を使う）。 */
export function describeCategoryRecord(r: CategoryRecord): string {
  const parts: string[] = [];
  if (r.mostTitles.length > 0) {
    parts.push(`最多優勝は${r.mostTitles.map((m) => `${m.name}（${m.count}回）`).join('・')}`);
  }
  if (r.longestStreaks.length > 0) {
    parts.push(`最長連覇は${r.longestStreaks.map((s) => `${s.name}の${s.length}連覇（${s.from}〜${s.to}年）`).join('・')}`);
  }
  return `${r.label}: ${parts.join('、')}。`;
}

/** 高校全国大会: 個人戦も所属校で数える。 */
export function toHighschoolRecordRows(rows: ChampionSummaryRow[]): RecordRow[] {
  return rows.map((row) => ({
    categoryId: row.categoryId,
    label: row.label,
    byYear: row.byYear.filter((c) => !!c.winner).map((c) => ({ year: c.year, holders: c.teams.filter((t) => !!t).map((t) => ({ key: t, name: t })) })),
  }));
}

/** 汎用大会ハブの優勝者1件（ページ側の championRows のうち記録に要る項目だけ）。 */
export type GenericChampion = {
  year: string | number;
  categoryLabel: string;
  /** singles / doubles / team。種目名が「男子」だけの大会（全日本シングルス等）で補う */
  category?: string | null;
  winner: string | null;
  winnerPlayers: { name: string; playerId: number | null }[] | null;
};

const GENDER_ONLY = new Set(['男子', '女子', '混合']);
const CATEGORY_NAME: Record<string, string> = { singles: 'シングルス', doubles: 'ダブルス', team: '団体' };

/** 高校以外の大会: 個人戦は選手（playerId があればそれで同一性を判定）、団体戦はチーム名で数える。 */
export function toGenericRecordRows(champions: GenericChampion[]): RecordRow[] {
  const order: string[] = [];
  const map = new Map<string, RecordRow>();
  for (const c of champions) {
    if (!c.winner) continue; // 打ち切り年は優勝者がいない
    if (!map.has(c.categoryLabel)) {
      // 表は「グループ見出し（シングルス等）＋男子」で読めるが、記録の1文は単独で読まれる（FAQ にも入る）ので種目名を補う
      const kind = c.category ? CATEGORY_NAME[c.category] : undefined;
      const label = kind && GENDER_ONLY.has(c.categoryLabel) ? `${c.categoryLabel}${kind}` : c.categoryLabel;
      map.set(c.categoryLabel, { categoryId: c.categoryLabel, label, byYear: [] });
      order.push(c.categoryLabel);
    }
    const holders: RecordHolder[] =
      c.winnerPlayers && c.winnerPlayers.length > 0
        ? c.winnerPlayers.map((p) => ({ key: p.playerId != null ? `id:${p.playerId}` : `name:${p.name}`, name: p.name }))
        : [{ key: `team:${c.winner}`, name: c.winner }];
    map.get(c.categoryLabel)!.byYear.push({ year: Number(c.year), holders });
  }
  return order.map((l) => map.get(l)!);
}
