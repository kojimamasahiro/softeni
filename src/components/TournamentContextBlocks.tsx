// src/components/TournamentContextBlocks.tsx
// 大会ハブページに差し込む「文脈ブロック」表示。
// milestone（連覇/初優勝など）と、優勝者の career-record（当サイト掲載分の通算成績・主要タイトル）を出す。
// データ生成は getStaticProps 側（lib/milestones.ts / lib/careerRecord.ts）。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import Link from 'next/link';

export type ContextMilestone = {
  kind: string;
  label: string;
  confidence: 'confirmed' | 'scope-limited';
  scopeNote?: string | null;
};

export type ContextChampionRecord = {
  slug: string;
  display: string;
  team: string | null;
  totals: { matches: number; wins: number; losses: number; winRate: number };
  titles: Array<{
    year: number;
    tournamentLabel: string;
    categoryLabel: string;
  }>;
  scopeNote: string;
};

export type TournamentContextData = {
  latestYear: string | null;
  milestones: ContextMilestone[];
  championRecords: ContextChampionRecord[];
};

function winPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export default function TournamentContextBlocks({
  label,
  data,
}: {
  label: string;
  data: TournamentContextData;
}) {
  const hasMilestones = data.milestones.length > 0;
  const hasRecords = data.championRecords.length > 0;
  if (!hasMilestones && !hasRecords) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold mb-3">
        {label} 注目ポイント
        {data.latestYear ? `（${data.latestYear}年度）` : ''}
      </h2>

      {hasMilestones && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {data.milestones.map((m, i) => (
            <li key={`${m.kind}-${i}`}>
              <span
                className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                title={m.scopeNote ?? undefined}
              >
                {m.label}
                {m.confidence === 'scope-limited' && (
                  <span className="ml-1 align-middle text-[10px] font-normal opacity-70">
                    ※当サイト掲載分
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasRecords && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.championRecords.map((r) => (
            <div
              key={r.slug}
              className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700"
            >
              <div className="mb-1 font-semibold">
                <Link
                  href={`/players/${r.slug}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.display}
                </Link>
                {r.team && (
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                    （{r.team}）
                  </span>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-200">
                通算 {r.totals.matches}試合 {r.totals.wins}勝{r.totals.losses}
                敗（勝率 {winPct(r.totals.winRate)}）
                <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                  ※{r.scopeNote}
                </span>
              </p>
              {r.titles.length > 0 && (
                <p className="mt-1 text-gray-600 dark:text-gray-300">
                  主なタイトル:{' '}
                  {r.titles
                    .slice(0, 4)
                    .map((t) => `${t.year} ${t.tournamentLabel}`)
                    .join(' / ')}
                  {r.titles.length > 4 ? ' ほか' : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
