// src/pages/news/[articleId].tsx
// /news/<articleId> 記事ページ（大会展望 / preview のみ）。
// 結果記事（result）は廃止し、結果・優勝・歴代まとめは大会ハブ／高校歴代ページに集約した（ADR-008）。
// 本文は LLM を使わず、文脈ブロック（前回王者・出場校 ほか）から決定的に構成する。
// 公開は state==='published' かつ type==='preview' の記事のみ。
// 設計: docs/wiki/news-context-blocks.md / ADR-005 / ADR-008。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  buildNewsArticleView,
  getArticleRecord,
  listPublishedPreviews,
  type EntryStanding,
  type NewsArticleView,
  type PreviewPlayerRef,
  type RecentAchiever,
} from '@/lib/newsArticle';
import { buildSiteUrl, siteConfig } from '@/lib/siteConfig';

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 選手名。結果ページ（/players/{id}/results）がある選手はリンク化する */
function PlayerName({ p }: { p: PreviewPlayerRef }) {
  if (p.playerId != null) {
    return (
      <Link
        href={`/players/${p.playerId}/results/`}
        className="text-blue-600 hover:underline dark:text-blue-400"
      >
        {p.name}
      </Link>
    );
  }
  return <>{p.name}</>;
}

/**
 * 今大会の途中経過/敗退バッジ（進行中の年のみ。results 未掲載なら何も出ない）。
 * alive=進行中（緑）/ champion=優勝（琥珀）/ runnerup=準優勝（琥珀）/ eliminated=敗退（灰）
 */
function StandingBadge({ standing }: { standing: EntryStanding | null }) {
  if (!standing) return null;
  const cls =
    standing.state === 'alive'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
      : standing.state === 'eliminated'
        ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100';
  return (
    <span
      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      今大会: {standing.label}
    </span>
  );
}

/** 選手名を「・」区切りで並べる（各名はリンク化されうる） */
function PlayerNames({ players }: { players: PreviewPlayerRef[] }) {
  return (
    <>
      {players.map((p, i) => (
        <span key={`${p.name}-${i}`}>
          {i > 0 && '・'}
          <PlayerName p={p} />
        </span>
      ))}
    </>
  );
}

export default function NewsArticlePage({ view }: { view: NewsArticleView }) {
  const { record, tournamentLabel, title, description, categories, hubHref } =
    view;
  const pageUrl = `https://softeni-pick.com/news/${record.articleId}/`;
  const isPreview = record.type === 'preview';

  // 記事専用 OGP（tools/sns-images/news_og.py がローカル生成）。無ければ既定カードへフォールバック。
  const hasArticleOg = Boolean(record.ogImage);
  const ogImageUrl = record.ogImage
    ? buildSiteUrl(record.ogImage)
    : siteConfig.ogImage;

  const publishedLabel = formatDate(record.createdAt);
  const updatedLabel = formatDate(record.updatedAt);

  const breadcrumbs = [
    { label: 'ホーム', href: '/' },
    { label: '大会展望', href: '/news/' },
    { label: title, href: `/news/${record.articleId}/` },
  ];

  return (
    <>
      <MetaHead
        title={`${title} | ソフトテニス情報`}
        description={description}
        url={pageUrl}
        type="article"
        image={ogImageUrl}
        {...(hasArticleOg
          ? {
              imageWidth: 1200,
              imageHeight: 630,
              twitterCardType: 'summary_large_image' as const,
            }
          : {})}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'NewsArticle',
              headline: title,
              inLanguage: 'ja',
              url: pageUrl,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              image: [ogImageUrl],
              about: {
                '@type': 'Thing',
                name: `ソフトテニス ${tournamentLabel}`,
              },
              author: {
                '@type': 'Organization',
                name: siteConfig.siteName,
                url: siteConfig.baseUrl,
              },
              publisher: {
                '@type': 'Organization',
                name: siteConfig.siteName,
                url: siteConfig.baseUrl,
                logo: {
                  '@type': 'ImageObject',
                  url: siteConfig.ogImage,
                },
              },
              ...(record.createdAt ? { datePublished: record.createdAt } : {}),
              dateModified: record.updatedAt ?? record.createdAt,
              description,
            }),
          }}
        />
      </Head>

      <PageLayout>
        <Breadcrumbs crumbs={breadcrumbs} />

        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        {(publishedLabel || updatedLabel) && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {publishedLabel && record.createdAt && (
              <time dateTime={record.createdAt}>公開: {publishedLabel}</time>
            )}
            {updatedLabel &&
              record.updatedAt &&
              record.updatedAt !== record.createdAt && (
                <time dateTime={record.updatedAt} className="ml-2">
                  更新: {updatedLabel}
                </time>
              )}
          </p>
        )}
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          {description}
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
            ※成績・記録は当サイト掲載大会分の集計に基づきます。
          </span>
        </p>

        {categories.length === 0 && (
          <p className="text-sm text-gray-500">掲載データがありません。</p>
        )}

        {categories.map((c) => (
          <section
            key={c.categoryId}
            className="mb-8 border-t border-gray-200 pt-5 dark:border-gray-700"
          >
            <h2 className="mb-3 text-lg font-bold">{c.categoryLabel}</h2>

            {/* 結果速報: 優勝者 + milestone */}
            {!isPreview && c.champion && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">優勝:</span> {c.champion}
              </p>
            )}
            {!isPreview && c.milestones.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {c.milestones.map((m, i) => (
                  <li key={`${m.kind}-${i}`}>
                    <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      {m.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* プレビュー: 連覇・防衛ウォッチ（前回王者の出場状況） */}
            {isPreview && c.titleDefense && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">連覇・防衛の行方</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  前回王者{' '}
                  <span className="font-semibold">
                    {c.titleDefense.players.length > 0 ? (
                      <>
                        {c.titleDefense.status === 'partial' ? (
                          <PlayerNames
                            players={c.titleDefense.players.filter(
                              (p) => p.returning,
                            )}
                          />
                        ) : (
                          <PlayerNames players={c.titleDefense.players} />
                        )}
                      </>
                    ) : (
                      c.titleDefense.defendingChampionDisplay
                    )}
                  </span>
                  {c.titleDefense.players.length > 0 &&
                    c.titleDefense.status !== 'partial' &&
                    c.titleDefense.team &&
                    `（${c.titleDefense.team}）`}
                  （{c.titleDefense.defendingYear}年優勝）
                  {c.titleDefense.status === 'absent' && 'は不在。新王者が誕生する。'}
                  {c.titleDefense.status !== 'absent' && (
                    <>
                      {c.titleDefense.standing?.state === 'champion'
                        ? 'が連覇を達成した。'
                        : c.titleDefense.standing?.state === 'runnerup'
                          ? 'は準優勝（連覇ならず）。'
                          : c.titleDefense.standing?.state === 'eliminated'
                            ? `は${c.titleDefense.standing.label}（連覇ならず）。`
                            : c.titleDefense.status === 'partial'
                              ? 'が今大会も出場し、新ペアで連覇を狙う。'
                              : 'が連覇に挑む。'}
                      <StandingBadge
                        standing={
                          c.titleDefense.standing?.state === 'alive'
                            ? c.titleDefense.standing
                            : null
                        }
                      />
                    </>
                  )}
                </p>
              </div>
            )}
            {isPreview && !c.titleDefense && c.previousChampion && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">前回王者:</span>{' '}
                {c.previousChampion}
              </p>
            )}

            {/* プレビュー: 前回入賞者（準優勝/ベスト4）の再登場 */}
            {isPreview && c.returningPlacers.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">
                  前回入賞者の再登場
                </h3>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-200">
                  {c.returningPlacers.map((p, i) => (
                    <li key={`${p.placement}-${i}`}>
                      前回{p.placement}:{' '}
                      <span className="font-semibold">
                        {p.players.length > 0 ? (
                          <PlayerNames players={p.players} />
                        ) : (
                          p.display
                        )}
                      </span>
                      {p.players.length > 0 && p.team && `（${p.team}）`}
                      {!p.intact && '（一部継続）'}
                      <StandingBadge standing={p.standing} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* プレビュー: 過去の優勝者（前々回以前）の再挑戦 */}
            {isPreview && c.returningFormerChampions.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">
                  過去の優勝者が再挑戦
                </h3>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-200">
                  {c.returningFormerChampions.map((f, i) => (
                    <li key={`former-${i}`}>
                      {f.years.join('・')}年優勝:{' '}
                      <span className="font-semibold">
                        {f.players.length > 0 ? (
                          <PlayerNames players={f.players} />
                        ) : (
                          f.display
                        )}
                      </span>
                      {f.players.length > 0 && f.team && `（${f.team}）`}
                      <StandingBadge standing={f.standing} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* プレビュー: 直近大会で好成績を残した出場者 */}
            {isPreview && c.recentAchievers.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">
                  直近大会の好成績者
                </h3>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-200">
                  {c.recentAchievers.map((a: RecentAchiever, i) => (
                    <li key={`recent-${i}`}>
                      <span className="font-semibold">
                        <PlayerName p={a.player} />
                      </span>
                      {' — '}
                      {a.tournamentLabel} {a.year} {a.categoryLabel}
                      <span className="ml-1 font-semibold">{a.placement}</span>
                      {a.isMajor && (
                        <span className="ml-2 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900 dark:text-rose-100">
                          主要大会
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* プレビュー: 出場規模・勢力図 */}
            {isPreview && c.fieldOverview && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">今大会の概況</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  出場{' '}
                  <span className="font-semibold">
                    {c.fieldOverview.entryCount}
                  </span>
                  {c.categoryId.startsWith('singles')
                    ? '選手'
                    : c.categoryId.startsWith('doubles')
                      ? 'ペア'
                      : c.categoryId.startsWith('team')
                        ? '校'
                        : '組'}
                  。
                  {c.fieldOverview.topPrefectures.length > 0 && (
                    <>
                      {' '}
                      都道府県別では{' '}
                      {c.fieldOverview.topPrefectures
                        .map((p) => `${p.prefecture}${p.count}`)
                        .join('、')}{' '}
                      が上位。
                    </>
                  )}
                </p>
                {c.fieldOverview.multiEntryTeams.length > 0 && (
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    複数エントリー校:{' '}
                    {c.fieldOverview.multiEntryTeams
                      .map((t) => `${t.team}（${t.count}）`)
                      .join('、')}
                  </p>
                )}
              </div>
            )}

            {/* 共通: 歴代優勝者 */}
            {c.historicalWinners.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">歴代優勝者</h3>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-200">
                  {c.historicalWinners.map((w) => (
                    <li key={w.year}>
                      {w.year}年: {w.display ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 結果速報: その年・種目の結果詳細ページへ */}
            {!isPreview && c.resultHref && (
              <p className="mt-3 text-sm">
                <Link
                  href={c.resultHref}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {record.year}年 {c.categoryLabel} の結果詳細を見る →
                </Link>
              </p>
            )}

            {/* プレビュー: その年・種目の大会結果ページへ（結果掲載後のみリンク化） */}
            {isPreview && c.resultHref && (
              <p className="mt-3 text-sm">
                <Link
                  href={c.resultHref}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {record.year}年 {c.categoryLabel} の大会結果を見る →
                </Link>
              </p>
            )}
          </section>
        ))}

        {hubHref && (
          <div className="mt-10 border-t border-gray-200 pt-5 dark:border-gray-700">
            <h2 className="mb-2 text-base font-bold">関連ページ</h2>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>
                <Link
                  href={hubHref}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {tournamentLabel} の歴代優勝者・大会まとめ
                </Link>
              </li>
            </ul>
          </div>
        )}

        <div className="mt-10 text-right">
          <Link href="/news/" className="text-sm text-blue-500 hover:underline">
            ニュース一覧へ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // 展望（preview）のみビルドする。結果記事は廃止し、結果・優勝・歴代まとめは
  // 大会ハブ／高校歴代ページに集約した（ADR-008）。
  const paths = listPublishedPreviews().map((r) => ({
    params: { articleId: r.articleId },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const articleId = (context.params as { articleId: string }).articleId;
  const record = getArticleRecord(articleId);
  if (!record || record.state !== 'published' || record.type !== 'preview') {
    return { notFound: true };
  }
  return { props: { view: buildNewsArticleView(record) } };
};
