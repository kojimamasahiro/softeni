// src/pages/news/index.tsx
// /news 記事一覧（プレビュー / 結果速報）。公開（published）記事のみ。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { buildNewsArticleView, listPublishedArticles } from '@/lib/newsArticle';

type NewsListItem = {
  articleId: string;
  type: 'preview' | 'result';
  title: string;
  updatedAt: string | null;
};

export default function NewsIndexPage({ items }: { items: NewsListItem[] }) {
  const pageUrl = 'https://softeni-pick.com/news/';
  return (
    <>
      <MetaHead
        title="ソフトテニス ニュース（大会展望・結果速報）"
        description="ソフトテニスの大会展望・結果速報。注目選手・前回王者・歴代優勝者・連覇/初優勝などを当サイト掲載データからまとめています。"
        url={pageUrl}
        type="website"
        noindex={items.length === 0}
      />
      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'ニュース', href: '/news/' },
          ]}
        />
        <h1 className="mb-4 text-2xl font-bold">
          ニュース（大会展望・結果速報）
        </h1>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">
            現在、公開中の記事はありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.articleId}
                className="rounded-md border border-gray-200 p-3 dark:border-gray-700"
              >
                <Link
                  href={`/news/${it.articleId}/`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {it.title}
                </Link>
                <span className="ml-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {it.type === 'preview' ? '展望' : '結果速報'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const items: NewsListItem[] = listPublishedArticles().map((r) => ({
    articleId: r.articleId,
    type: r.type,
    title: buildNewsArticleView(r).title,
    updatedAt: r.updatedAt ?? null,
  }));
  return { props: { items } };
};
