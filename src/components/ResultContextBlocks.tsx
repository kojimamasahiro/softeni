// src/components/ResultContextBlocks.tsx
// 年度×種目の結果ページに差し込む「文脈ブロック（注目ポイント）」表示。
// 過去の優勝者データ＋当年の試合から導けるイベント（連覇 / 初優勝 / 王者撃破）を
// バッジで表示する。データ生成は getStaticProps 側（lib/milestones.ts）。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import type { ContextMilestone } from './TournamentContextBlocks';

export default function ResultContextBlocks({ label, year, milestones }: { label: string; year: string; milestones: ContextMilestone[] }) {
  if (milestones.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-2">
        {label} {year}年度 注目ポイント
      </h2>
      <ul className="flex flex-wrap gap-2">
        {milestones.map((m, i) => (
          <li key={`${m.kind}-${i}`}>
            <span
              className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
              title={m.scopeNote ?? undefined}
            >
              {m.label}
              {m.scopeNote && <span className="ml-1 align-middle text-[10px] font-normal opacity-70">※当サイト掲載分</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
