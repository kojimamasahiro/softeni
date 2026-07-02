import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import MetaHead from '@/components/MetaHead';
import { Card, getTargetMeta, PracticeThemes } from '@/components/growth/GrowthReportView';
import { gatherShowcaseRecords, loadFeaturedEntries, loadGrowthTargets, showcaseDisplayName, type ShowcaseRecord } from '@/lib/growthShowcase';
import { buildSiteUrl, isScoreSiteMode } from '@/lib/siteConfig';

type ShowcaseProps = {
  slug: string;
  title: string;
  intro: string | null;
  records: ShowcaseRecord[];
  playerId: string | null;
};

// 成長記録ショーケース（運営キュレーションの公開ページ・インデックス対象）。
// 対象は data/growth-featured.json の featured のみ（ADR-004）。
// その選手のシングルス記録と、その選手を含むペア記録の両方を表示する。
export default function GrowthShowcasePage({ slug, title, intro, records, playerId }: ShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = records[activeIndex] ?? records[0];
  const target = active?.report.target;
  const pageUrl = buildSiteUrl(`/growth/${slug}/`);

  return (
    <>
      <MetaHead
        title={`${title} | 成長記録`}
        description={`${title}。シングルス・ダブルスの試合内容の変化を、サーブ・レシーブ・競り合いなどの指標で追った成長記録です。`}
        url={pageUrl}
        type="article"
      />
      <div className="min-h-screen bg-white px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-4">
            <Link href="/growth" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              成長記録一覧へ
            </Link>
            {playerId && (
              <Link href={`/players/${playerId}/results`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                この選手の試合結果ページへ
              </Link>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-bold">{title}</h1>

          <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/70">
            <h2 className="text-lg font-semibold">この成長記録でわかること</h2>
            <p className="mt-2 text-sm leading-7 text-gray-700 dark:text-gray-200">
              {intro ??
                '勝ち負けだけでは見えない「試合内容の変化」を、サーブ時の得点率、レシーブ、競り合い（デュースやゲームポイント）、流れの立て直しといった指標で追っています。1試合ごとの結果ではなく、最近の傾向としてどこが伸びているかを可視化した記録です。'}
            </p>
          </section>

          {/* シングルス/ダブルスの記録切り替え */}
          {records.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {records.map((record, index) => (
                <button
                  key={record.key}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    index === activeIndex
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                  }`}
                >
                  {record.label}
                </button>
              ))}
            </div>
          )}

          {target && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              {active.label} ／ {getTargetMeta(target)}
            </p>
          )}

          {active?.report.emptyMessage ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {active.report.emptyMessage}
            </div>
          ) : (
            active && (
              <div className="mt-4 space-y-5">
                {active.report.sections.map((section) => (
                  <Card key={section.id} title={section.title} messages={section.messages} metrics={section.metrics} />
                ))}

                <PracticeThemes themes={active.report.practiceThemes} />
              </div>
            )
          )}

          {/* もとにした試合（出所） */}
          {active && active.sourceMatches.length > 0 && (
            <section className="mt-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">もとにした試合（{active.sourceMatches.length}試合）</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">この成長記録は、以下の試合の記録から作成しています。</p>
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                {active.sourceMatches.map((source) => (
                  <li key={source.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{source.date ?? '日付不明'}</span>
                    <Link href={source.detailPath} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      vs {source.opponentName}
                    </Link>
                    {source.tournamentName && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {source.tournamentName}
                        {source.roundName ? ` ${source.roundName}` : ''}
                      </span>
                    )}
                    {source.videoUrl && (
                      <a href={source.videoUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline dark:text-red-400">
                        動画
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* score 導線プレースホルダ。score の方針が固まるまで配線しない（ADR-004）。 */}
          <section className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white p-5 text-center dark:border-gray-600 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">自分の試合でもこうした成長記録をつけられます</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">（score 連携は準備中です）</p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-3 cursor-not-allowed rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            >
              準備中
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // ショーケースは softeni-pick 本体の公開コンテンツ。score モードでは持たない。
  if (isScoreSiteMode()) {
    return { paths: [], fallback: false };
  }

  const featured = loadFeaturedEntries();
  return {
    paths: featured.map((entry) => ({ params: { slug: entry.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ShowcaseProps> = async (context) => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  const slug = context.params?.slug as string;
  const entry = loadFeaturedEntries().find((item) => item.slug === slug);
  if (!entry) {
    return { notFound: true };
  }

  const targets = loadGrowthTargets();
  const records = gatherShowcaseRecords(entry, targets);
  if (records.length === 0) {
    return { notFound: true };
  }

  return {
    props: {
      slug: entry.slug,
      title: entry.title ?? `${showcaseDisplayName(entry, targets)} の成長記録`,
      intro: entry.intro ?? null,
      records,
      playerId: entry.playerId != null ? String(entry.playerId) : null,
    },
  };
};
