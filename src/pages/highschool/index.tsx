// src/pages/highschool/index.tsx
// 高校特集の入口ページ(セクション入口・ページタイプ T2)。
// 以前は /highschool/boys への meta refresh 振り分け(noindex)だったが、
// 男子・女子・全国大会歴代記録への入口ページに変更(docs/ui M2-2・C-4)。
// 男女の入口を対称にし、girls への到達を1段浅くする。
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

const SECTIONS = [
  {
    href: '/highschool/boys/',
    title: '高校男子',
    description: '全国大会成績の都道府県別一覧・学校ページ',
  },
  {
    href: '/highschool/girls/',
    title: '高校女子',
    description: '全国大会成績の都道府県別一覧・学校ページ',
  },
  {
    href: '/highschool/tournaments/',
    title: '全国大会の歴代記録',
    description: 'インターハイ・ハイスクールジャパンカップの歴代優勝校',
  },
];

export default function HighschoolIndex() {
  const pageUrl = 'https://softeni-pick.com/highschool/';

  return (
    <>
      <MetaHead
        title="高校ソフトテニス | 全国大会成績・歴代記録 | Softeni Pick"
        description="高校ソフトテニスの特集ページ。男子・女子の全国大会成績(都道府県別・学校別)と、インターハイ・ハイスクールジャパンカップの歴代記録をまとめています。"
        url={pageUrl}
        type="website"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://softeni-pick.com/' },
                { '@type': 'ListItem', position: 2, name: '高校', item: pageUrl },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '高校', href: '/highschool' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">高校ソフトテニス</h1>
        <p className="text-sm text-text-muted dark:text-gray-400 mb-6">
          高校カテゴリの特集ページです。男女別の全国大会成績と、全国大会の歴代記録をまとめています。
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle"
            >
              <h2 className="text-base font-semibold text-text">{s.title}</h2>
              <p className="text-xs text-text-muted">{s.description}</p>
            </Link>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
