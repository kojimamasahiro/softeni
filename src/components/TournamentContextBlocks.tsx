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

/**
 * 最新年度の「前哨戦」サマリ（種目ごと 1 行）。
 * ハブは年度なしの歴代まとめが主なので、個々の対戦カードは出さずに規模だけを示し、
 * 詳細は年度別結果ページ／展望記事へ送る（[seo.md](../../docs/wiki/seo.md) #4 のインテント分割）。
 */
export type ContextPriorMeetingSummary = {
  categoryLabel: string;
  /** 既知の対戦カード数 */
  cards: number;
  /** 対戦履歴を持つ出場数 / 全出場数 */
  covered: number;
  total: number;
  unit: 'ペア' | '選手' | '校';
  href: string | null;
};

export type TournamentContextData = {
  latestYear: string | null;
  milestones: ContextMilestone[];
  championRecords: ContextChampionRecord[];
  priorMeetings?: ContextPriorMeetingSummary[];
};

function winPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

export default function TournamentContextBlocks({ label, data }: { label: string; data: TournamentContextData }) {
  const hasMilestones = data.milestones.length > 0;
  const hasRecords = data.championRecords.length > 0;
  const priorMeetings = data.priorMeetings ?? [];
  if (!hasMilestones && !hasRecords && priorMeetings.length === 0) return null;

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
                <Link href={`/players/${r.slug}`} className="text-link hover:underline">
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

      {/*
        前哨戦のサマリ。ハブは「年度なしの歴代まとめ」が主インテントなので、個々の対戦カードは
        出さずに規模だけを示し、詳細は年度別結果ページへ送る（seo.md #4 のインテント分割）。
      */}
      {priorMeetings.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold">前哨戦{data.latestYear ? `（${data.latestYear}年度）` : ''}</h3>
          <ul className="space-y-0.5 text-sm text-text-secondary">
            {priorMeetings.map((p) => (
              <li key={p.categoryLabel}>
                {p.href ? (
                  <Link href={p.href} className="text-link hover:underline">
                    {p.categoryLabel}
                  </Link>
                ) : (
                  p.categoryLabel
                )}
                : 出場 {p.total}
                {p.unit}中 <span className="font-semibold">{p.covered}</span>
                {p.unit}が直近大会で対戦経験あり（{p.cards} 件の対戦カード）
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-text-muted">※当サイト掲載分の試合データによる</p>
        </div>
      )}
    </section>
  );
}
