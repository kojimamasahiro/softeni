// src/components/PlayerUpcomingInternational.tsx
//
// 選手ページの「これから開催される国際大会」ブロック。
// 予選会に出場した選手、または公式発表の代表名簿に載っている選手に出し、
// 本大会の会期・会場へ導く（docs/wiki/upcoming-tournaments-runbook.md S1・S9）。
//
// 置き場所は結果ページの「他機能への導線（第3カテゴリ）」の並び。
// 集計でも試合結果の生データでもない導線という点で、スコア詳細・成長記録と同じ性質のため
// （2026-08-07 決定の方針を踏襲）。該当者のみ・畳まずコンパクトに出す。
//
// 予選会だけを根拠にするとき、**書けるのは2つの事実だけ**——「予選会に出場した」
// 「本大会がいつどこで開催される」。予選会はシングルスのみで団体・混合の選考は別経路のため、
// 予選会の成績から日本代表は導出できない。
// **公式発表の名簿がある場合に限り**「日本代表に選出されている」と書き、出典を必ず併記する
// （当サイトの推定ではなく転記であることを読者が確かめられるようにするため）。
//
// 表記ルール: 絵文字は使わない（AGENTS.md。eslint で強制）。

import Link from 'next/link';

import type { UpcomingInternationalLink } from '@/lib/upcomingInternational';

function formatAnnouncedOn(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : d;
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const fmt = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? `${Number(m[2])}月${Number(m[3])}日` : d;
  };
  const year = start.slice(0, 4);
  if (!end || end === start) return `${year}年${fmt(start)}`;
  return `${year}年${fmt(start)}〜${fmt(end)}`;
}

export default function PlayerUpcomingInternational({ fullName, links }: { fullName: string; links: UpcomingInternationalLink[] }) {
  if (links.length === 0) return null;

  return (
    <>
      {links.map((l) => {
        const dateRange = formatDateRange(l.startDate, l.endDate);
        const place = [l.location, l.venueName].filter(Boolean).join(' ');
        const announced = formatAnnouncedOn(l.delegation?.announcedOn ?? null);

        return (
          <section key={l.mainTournamentId} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {l.hasStarted ? '開催中' : '開催予定'}
              </span>
              {l.delegation && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  日本代表
                </span>
              )}
              <h2 className="text-base font-bold">{l.mainLabel}</h2>
            </div>

            {l.delegation ? (
              <>
                <p className="mb-1 text-sm text-text-secondary">
                  {fullName}は{l.mainLabel}の日本代表に選出されています
                  {l.delegation.categoryLabels.length > 0 ? `（出場種目: ${l.delegation.categoryLabels.join('・')}）` : ''}。
                </p>
                <p className="mb-2 text-xs text-text-muted">
                  出典:{' '}
                  <a href={l.delegation.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                    {l.delegation.source}
                  </a>
                  {announced ? `（${announced}発表）` : ''}
                </p>
                {/* 名簿がある場合は予選会の成績を併記しない。団体・混合は予選会を経ずに選ばれるため、
                    成績を並べると選考の根拠であるかのように読めてしまう。導線としてのリンクだけ残す。 */}
                {l.qualifierLabel && l.qualifierHref && (
                  <p className="mb-2 text-sm text-text-secondary">
                    <Link href={l.qualifierHref} className="text-link hover:underline">
                      {l.qualifierLabel}
                    </Link>
                    （{l.qualifierYear}年度）にも出場しています。
                  </p>
                )}
              </>
            ) : (
              l.qualifierLabel && (
                <p className="mb-2 text-sm text-text-secondary">
                  {fullName}は
                  {l.qualifierHref ? (
                    <Link href={l.qualifierHref} className="text-link hover:underline">
                      {l.qualifierLabel}
                    </Link>
                  ) : (
                    l.qualifierLabel
                  )}
                  （{l.qualifierYear}年度）に出場
                  {l.placementLabel ? `し、${l.placementLabel}` : ''}
                  しています。
                </p>
              )
            )}

            <p className="mb-3 text-sm text-text-secondary">
              {l.mainLabel}は{dateRange ? `${dateRange}、` : ''}
              {place ? `${place}で` : ''}
              開催されます。
            </p>

            <Link href={l.mainHref} className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
              {l.mainLabel}の日程・会場を見る
              <span aria-hidden>›</span>
            </Link>
          </section>
        );
      })}
    </>
  );
}
