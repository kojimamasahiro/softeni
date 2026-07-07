// pages/highschool/tournaments/index.tsx
// 高校カテゴリ「全国大会の歴代記録」入口ページ。
// 都道府県別・学校別とは別に、代表的な全国大会（インターハイ・ハイスクールジャパンカップ）の
// 歴代記録ページへ誘導する。

import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { listHsNationalTournamentSummaries, type TournamentSummary } from '@/lib/highschoolNationalTournaments';

type Props = {
  tournaments: TournamentSummary[];
};

function formatYearRange(t: TournamentSummary): string {
  if (t.earliestYear === null || t.latestYear === null) return '収録準備中';
  return t.earliestYear === t.latestYear ? `${t.latestYear}年` : `${t.earliestYear}〜${t.latestYear}年`;
}

export default function HighschoolTournamentsIndex({ tournaments }: Props) {
  const pageUrl = 'https://softeni-pick.com/highschool/tournaments/';

  return (
    <>
      <MetaHead
        title="高校 全国大会の歴代記録（インターハイ・ハイスクールジャパンカップ） | ソフトテニス情報"
        description="高校ソフトテニスの代表的な全国大会（インターハイ＝全国高等学校総合体育大会、ハイスクールジャパンカップ＝通称「ハイジャパ」）の歴代結果・優勝〜ベスト4を年度別・種目別にまとめた入口ページです。"
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '高校',
                  item: 'https://softeni-pick.com/highschool/boys/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: '全国大会の歴代記録',
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: '高校 全国大会の歴代記録',
              itemListElement: tournaments.map((t, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: t.label,
                url: `https://softeni-pick.com/highschool/tournaments/${t.slug}/`,
              })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '高校', href: '/highschool/boys/' },
            { label: '全国大会の歴代記録', href: '/highschool/tournaments/' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">高校 全国大会の歴代記録</h1>

        <div className="mb-8 space-y-3 text-sm text-text-secondary">
          <p>高校ソフトテニスの代表的な全国大会について、歴代の上位入賞（優勝〜ベスト4）を 年度別・種目別にまとめています。</p>
          <p>
            都道府県別・学校別ページが「各校の成績」を学校視点で整理しているのに対し、
            こちらは大会そのものを軸に、その年の頂点に立った学校・ペア・選手を横断的に確認できます。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <Link
              key={t.slug}
              href={`/highschool/tournaments/${t.slug}/`}
              className="rounded-xl border border-border p-5 bg-surface hover:bg-bg-subtle transition"
            >
              <p className="text-lg font-semibold">{t.shortLabel}</p>
              {t.label !== t.shortLabel && <p className="text-xs text-text-muted mt-0.5">{t.label}</p>}
              {t.aliases && t.aliases.length > 0 && <p className="text-xs text-text-muted mt-0.5">通称: {t.aliases.join('・')}</p>}
              <p className="text-sm text-text-secondary mt-3">{t.description}</p>
              <p className="text-xs text-text-muted mt-3">収録年度: {formatYearRange(t)}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-sm">
          <Link href="/highschool/boys/" className="text-info hover:underline">
            高校 都道府県別・学校別ページへ →
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  return {
    props: {
      tournaments: listHsNationalTournamentSummaries(),
    },
  };
};
