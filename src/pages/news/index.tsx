// src/pages/news/index.tsx
// /news 記事一覧（プレビュー / 結果速報）。公開（published）記事のみ。
// 設計: docs/wiki/news-context-blocks.md / ADR-005。

import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { buildNewsArticleView, listPublishedPreviews } from '@/lib/newsArticle';

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
        title="ソフトテニス 大会展望（前回王者・出場校）"
        description="ソフトテニスの大会展望。前回王者の連覇・防衛、前回入賞者の再登場、出場校の勢力図などを当サイト収録データからまとめています。確定した結果・優勝・歴代は各大会ページに掲載しています。"
        url={pageUrl}
        type="website"
        noindex={items.length === 0}
      />
      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会展望', href: '/news/' },
          ]}
        />
        <h1 className="mb-4 text-2xl font-bold">大会展望</h1>

        {items.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-6 text-center">
            <p className="text-sm">公開中の大会展望がありません。</p>
            <p className="mt-1 text-xs text-text-muted">大会展望は開催前に公開しています。過去の結果は大会一覧から確認できます。</p>
            <Link href="/tournaments/" className="mt-3 inline-block text-sm text-link hover:underline">
              大会一覧を見る
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.articleId} className="rounded-md border border-border p-3">
                <Link href={`/news/${it.articleId}/`} className="font-semibold text-link hover:underline">
                  {it.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const items: NewsListItem[] = listPublishedPreviews().map((r) => ({
    articleId: r.articleId,
    type: r.type,
    title: buildNewsArticleView(r).title,
    updatedAt: r.updatedAt ?? null,
  }));
  return { props: { items } };
};
