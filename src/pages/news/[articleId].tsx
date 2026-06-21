// src/pages/news/[articleId].tsx
// /news/<articleId> 記事ページ（プレビュー / 結果速報）。
// 本文は LLM を使わず、文脈ブロック（historical-winners / milestone / career-record）から
// 決定的に構成する。公開は state==='published' の記事のみ。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  buildNewsArticleView,
  getArticleRecord,
  listPublishedArticles,
  type NewsArticleView,
} from '@/lib/newsArticle';
import { buildSiteUrl, siteConfig } from '@/lib/siteConfig';

function winPct(wins: number, matches: number): string {
  if (matches <= 0) return '-';
  return `${Math.round((wins / matches) * 1000) / 10}%`;
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
    { label: 'ニュース', href: '/news/' },
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

            {/* プレビュー: 前回王者 + 注目選手 */}
            {isPreview && c.previousChampion && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">前回王者:</span>{' '}
                {c.previousChampion}
              </p>
            )}
            {isPreview && c.notablePlayers.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">注目選手</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {c.notablePlayers.map((p) => (
                    <div
                      key={p.slug}
                      className="rounded-md border border-gray-200 p-2 text-sm dark:border-gray-700"
                    >
                      <Link
                        href={`/players/${p.slug}`}
                        className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {p.display}
                      </Link>
                      {p.team && (
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                          （{p.team}）
                        </span>
                      )}
                      <div className="text-gray-700 dark:text-gray-200">
                        通算 {p.matches}試合 {p.wins}勝（勝率{' '}
                        {winPct(p.wins, p.matches)}）
                      </div>
                      {p.titles.length > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          主なタイトル: {p.titles.join(' / ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 共通: 歴代優勝者 */}
            {c.historicalWinners.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">
                  {tournamentLabel} 歴代優勝者（{c.categoryLabel}）
                </h3>
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
  const paths = listPublishedArticles().map((r) => ({
    params: { articleId: r.articleId },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const articleId = (context.params as { articleId: string }).articleId;
  const record = getArticleRecord(articleId);
  if (!record || record.state !== 'published') {
    return { notFound: true };
  }
  return { props: { view: buildNewsArticleView(record) } };
};
