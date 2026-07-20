// src/components/PlayerMajorResults.tsx
// 選手の主要大会実績を、カテゴリ別の最高成績として並べる。選手結果ページの h1 直下に置く。
//
// 方針（2026-07-20 ユーザー決定）:
// - 対象は**ベスト8以上**（優勝 / 準優勝 / ベスト4 / ベスト8）。それ未満は出さない。
// - **カテゴリごとに 1 タイル**（ジュニア → 高校 → 大学 → 総合 → 国際大会 → シニア）。
//   タイルに出すのは **カテゴリ名と最高成績だけ**。「どのカテゴリでどこまで行ったか」が
//   一目で分かることだけを目的にし、大会名・年度・種目は下の展開（`<details>`）に送る。
// - 展開はタイルごとではなく**セクションに 1 つ**。タイルが小さいのでタイル内に畳むと
//   開いたときにグリッドが崩れるため、まとめて 1 箇所で開く。
// - 記録が無いカテゴリはタイル自体を出さない（未収録による欠落は許容仕様）。
// - **アイコン・絵文字は使わない**（2026-07-20 決定 / AGENTS.md「UI の表記ルール」）。
//   成績は必ず文字で示し、色は淡いトーンの補助に留める。
// - 大会名は通称（インターハイ 等）を literal で出す（docs/wiki/seo.md #3）。
//   展開の中身は `<details>` なので閉じていても DOM にあり、クローラには読まれる。
//
// 対象大会の定義は lib/nationalTitles.ts（`majorCategory !== null`）。
// 「全国大会優勝」の SEO 文言とは対象集合が違う（社会人/国際大会の扱いが逆）ので注意。

import { MAJOR_CATEGORY_ORDER } from '@/lib/nationalTitles';
import type { MajorCategoryResult } from '@/types/playerStatistics';

/**
 * 成績ごとの淡いトーン。色は補助であって情報の担い手ではない
 * （色が見えなくても成績は文字で読める）。
 */
const RANK_TONE: Record<number, string> = {
  1: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100',
  2: 'border-border-strong bg-bg-subtle text-text',
  4: 'border-orange-200 bg-orange-50/70 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100',
  8: 'border-border bg-surface text-text-secondary',
};

export default function PlayerMajorResults({ results, scopeNote }: { results: MajorCategoryResult[]; scopeNote?: string }) {
  if (!results || results.length === 0) return null;

  // 念のため表示順を固定（集計側でも並べているが、公開 JSON 経由で順序が崩れても壊れないように）
  const ordered = [...results].sort((a, b) => MAJOR_CATEGORY_ORDER.indexOf(a.category) - MAJOR_CATEGORY_ORDER.indexOf(b.category));
  const totalEntries = ordered.reduce((n, r) => n + r.entries.length, 0);

  return (
    <section className="mt-4 rounded-xl border border-border bg-bg-subtle/60 p-3" aria-label="主要大会の実績">
      <h2 className="mb-2 text-xs font-bold tracking-wide text-text-secondary">主要大会の最高成績（ベスト8以上）</h2>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ordered.map((r) => (
          <li key={r.category} className={`rounded-lg border px-2.5 py-2 text-center ${RANK_TONE[r.best.placementRank] ?? RANK_TONE[8]}`}>
            <p className="text-[11px] font-medium opacity-80">{r.categoryLabel}</p>
            <p className="mt-0.5 text-sm font-bold">{r.best.placementLabel}</p>
          </li>
        ))}
      </ul>

      {/* 開閉トグル。リンク色（青）だとページ遷移に見えるので使わない。
          「その場で開く」ことが分かるよう、文言＋▼▲の入れ替えで状態を示す
          （`group-open:` で切り替える既存の慣例に合わせる。beta の分析ページ等と同じ）。 */}
      <details className="group mt-2 border-t border-border pt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-text-secondary hover:text-text">
          <span>
            大会名・年度を
            <span className="group-open:hidden">見る</span>
            <span className="hidden group-open:inline">閉じる</span>（{totalEntries}件）
          </span>
          <span aria-hidden className="text-text-muted group-open:hidden">
            ▼
          </span>
          <span aria-hidden className="hidden text-text-muted group-open:inline">
            ▲
          </span>
        </summary>
        <div className="mt-2 space-y-2.5">
          {ordered.map((r) => (
            <div key={r.category}>
              <p className="text-[11px] font-bold text-text-secondary">{r.categoryLabel}</p>
              <ul className="mt-0.5 space-y-0.5">
                {r.entries.map((e, i) => (
                  <li key={`${e.tournamentId}-${e.year}-${e.categoryId}-${i}`} className="text-xs text-text-secondary">
                    {e.year}年度 {e.shortLabel} {e.placementLabel}
                    <span className="text-text-muted">（{e.discipline}）</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {scopeNote && <p className="mt-2 text-xs text-text-muted">{scopeNote}</p>}
    </section>
  );
}
