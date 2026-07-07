// src/components/TournamentContextBlocks.tsx
// 大会ハブページに差し込む「文脈ブロック」表示。
// milestone（連覇/初優勝など）と、優勝者の career-record（当サイト掲載分の通算成績・主要タイトル）を出す。
// データ生成は getStaticProps 側（lib/milestones.ts / lib/careerRecord.ts）。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import Link from 'next/link';

import MilestoneBadge from './MilestoneBadge';

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

export default function TournamentContextBlocks({ label, data }: { label: string; data: TournamentContextData }) {
  const hasMilestones = data.milestones.length > 0;
  const hasRecords = data.championRecords.length > 0;
  if (!hasMilestones && !hasRecords) return null;

  const hasScopeLimitedMilestone = data.milestones.some((m) => m.confidence === 'scope-limited');

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
              <MilestoneBadge kind={m.kind} label={m.label} scopeNote={m.scopeNote} />
            </li>
          ))}
        </ul>
      )}
      {hasScopeLimitedMilestone && <p className="mb-4 -mt-2 text-[10px] opacity-70">※当サイト掲載分</p>}

      {hasRecords && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.championRecords.map((r) => (
            <div key={r.slug} className="rounded-md border border-border p-3 text-sm">
              <div className="mb-1 font-semibold">
                <Link href={`/players/${r.slug}`} className="text-primary hover:underline">
                  {r.display}
                </Link>
                {r.team && <span className="ml-1 text-xs text-text-muted">（{r.team}）</span>}
              </div>
              <p className="text-gray-700 dark:text-gray-200">
                通算 {r.totals.matches}試合 {r.totals.wins}勝{r.totals.losses}
                敗（勝率 {winPct(r.totals.winRate)}）<span className="ml-1 text-[10px] text-text-muted">※{r.scopeNote}</span>
              </p>
              {r.titles.length > 0 && (
                <p className="mt-1 text-text-secondary">
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
