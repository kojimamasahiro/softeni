// src/components/PlayerCareerHighlights.tsx
// 選手プロフィールページに差し込む「主な戦績（当サイト掲載分）」。
// career-record（通算成績・優勝歴）と milestone（連覇/初優勝）を選手視点で再利用する。
// データ生成は getStaticProps 側（lib/careerRecord.ts / lib/milestones.ts）。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import Link from 'next/link';

export type PlayerHighlightMilestone = {
  kind: string;
  label: string;
  confidence: 'confirmed' | 'scope-limited';
  scopeNote?: string | null;
};

export type PlayerHighlightTitle = {
  year: number;
  tournamentLabel: string;
  categoryLabel: string;
  tournamentLink?: string | null;
};

export type PlayerCareerHighlightsData = {
  milestones: PlayerHighlightMilestone[];
  totals: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
  } | null;
  titles: PlayerHighlightTitle[];
  scopeNote: string;
};

function winPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export default function PlayerCareerHighlights({ fullName, data }: { fullName: string; data: PlayerCareerHighlightsData }) {
  const hasMilestones = data.milestones.length > 0;
  const hasTotals = !!data.totals && data.totals.matches > 0;
  const hasTitles = data.titles.length > 0;
  if (!hasMilestones && !hasTotals && !hasTitles) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3">
        主な戦績
        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">※{data.scopeNote}</span>
      </h2>

      {hasMilestones && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {data.milestones.map((m, i) => (
            <li key={`${m.kind}-${i}`}>
              <span
                className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                title={m.scopeNote ?? undefined}
              >
                {m.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasTotals && data.totals && (
        <p className="mb-3 text-sm text-gray-800 dark:text-gray-200">
          {fullName}の通算成績は {data.totals.matches}試合 {data.totals.wins}勝{data.totals.losses}敗（勝率 {winPct(data.totals.winRate)}）です。
        </p>
      )}

      {hasTitles && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">優勝歴</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {data.titles.map((t, i) => (
              <li key={`${t.year}-${t.tournamentLabel}-${i}`}>
                {t.year}年{' '}
                {t.tournamentLink ? (
                  <Link href={t.tournamentLink} className="underline underline-offset-2 decoration-dotted hover:decoration-solid">
                    {t.tournamentLabel}
                  </Link>
                ) : (
                  t.tournamentLabel
                )}
                {t.categoryLabel ? `（${t.categoryLabel}）` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
