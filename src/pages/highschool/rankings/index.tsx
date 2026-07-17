// src/pages/highschool/rankings/index.tsx
// 高校ソフトテニス 強豪校ランキング(全国・男女別)。
// 収録済みの高校全国大会(インターハイ・ハイジャパ・選抜)の成績をポイント化した独自集計。
// 1 URL に集約し男女はクライアント切替(薄いページを量産しない。docs/wiki/seo.md の方針)。
// タブ裏はクローラに見えないため、男女の上位まとめを静的 HTML でも掲載する(seo.md #9 と同型)。
// 配点・経緯: docs/raw/2026-07-17-idea-highschool-strong-school-ranking.md

import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { buildSchoolRankingBoards, type SchoolRankingBoard } from '@/lib/highschoolRanking';

const TOP_N = 100;

type Props = {
  boards: SchoolRankingBoard[];
};

const GENDER_LABEL: Record<string, string> = { boys: '男子', girls: '女子' };

export default function HighschoolRankingsPage({ boards }: Props) {
  const [tab, setTab] = useState(0);
  const board = boards[Math.min(tab, Math.max(boards.length - 1, 0))];
  const latestYear = board?.latestYear ?? new Date().getFullYear();
  const minYear = board?.minYear ?? latestYear;

  const pageUrl = 'https://softeni-pick.com/highschool/rankings/';
  const description = `高校ソフトテニスの強豪校ランキング(全国・男女別)。当サイト収録のインターハイ・ハイスクールジャパンカップ・全日本高校選抜の成績(${minYear}〜${latestYear}年)をポイント化した独自集計です。学校ごとの全国大会成績ページへもたどれます。`;

  const faqItems = [
    {
      question: 'このランキングは公式のものですか？',
      answer: 'いいえ。日本ソフトテニス連盟や高体連が発表する公式ランキングではなく、当サイトに収録された全国大会の成績をポイント化した独自集計です。',
    },
    {
      question: 'ポイントはどのように計算していますか？',
      answer: `優勝10点・準優勝6点・ベスト4は4点・ベスト8は2点・その他の出場0.5点を基礎点とし、団体戦は2倍、個人戦(ダブルス・シングルス)は1倍で計算します。さらに年度の新しさで重み(直近から1.0/0.8/0.6、それ以前0.3)を掛けて合算しています。`,
    },
    {
      question: '対象の大会はどれですか？',
      answer: `当サイト収録分のインターハイ(全国高等学校総合体育大会)、ハイスクールジャパンカップ、全日本高校選抜が対象です(${minYear}〜${latestYear}年)。国体(国民スポーツ大会)と未収録年度の選抜は含まれません。データ追加にあわせて順次反映します。`,
    },
  ];

  return (
    <>
      <MetaHead title="高校ソフトテニス 強豪校ランキング(全国・男女別) | Softeni Pick" description={description} url={pageUrl} type="article" />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://softeni-pick.com/' },
                { '@type': 'ListItem', position: 2, name: '高校ソフトテニス', item: 'https://softeni-pick.com/highschool/' },
                { '@type': 'ListItem', position: 3, name: '強豪校ランキング', item: pageUrl },
              ],
            }),
          }}
        />
        {board && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `高校ソフトテニス 強豪校ランキング(${GENDER_LABEL[board.gender]})`,
                description,
                url: pageUrl,
                numberOfItems: Math.min(10, board.entries.length),
                itemListOrder: 'https://schema.org/ItemListOrderAscending',
                itemListElement: board.entries.slice(0, 10).map((e) => ({
                  '@type': 'ListItem',
                  position: e.rank,
                  name: `${e.team}（${e.prefecture}）`,
                  url: `https://softeni-pick.com/highschool/${e.gender}/${e.prefectureId}/${e.teamId}`,
                })),
              }),
            }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            }),
          }}
        />
      </Head>

      <PageLayout className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '高校ソフトテニス', href: '/highschool' },
            { label: '強豪校ランキング', href: '/highschool/rankings' },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">高校ソフトテニス 強豪校ランキング</h1>
          <p className="mt-2 text-sm text-text-secondary">
            当サイト収録の全国大会(インターハイ・ハイスクールジャパンカップ・全日本高校選抜、{minYear}〜{latestYear}
            年)の成績をポイント化した、全国・男女別の独自ランキングです。 配点は<strong>優勝10・準優勝6・ベスト4 4・ベスト8 2・出場0.5</strong>を基礎点に、
            <strong>団体戦2倍</strong>・年度の新しさで重み(直近から1.0/0.8/0.6、それ以前0.3)を掛けて合算しています。
          </p>
          <p className="mt-1 text-xs text-text-muted">
            ※
            公式ランキングではありません。当サイト収録大会のみが対象で、国体(国民スポーツ大会)と未収録年度の全日本高校選抜は含まれません(データ追加にあわせて順次反映)。
          </p>
        </header>

        {/* 男女タブ */}
        <div className="border-b border-border">
          <div className="-mb-px flex flex-wrap gap-1">
            {boards.map((b, i) => {
              const active = board === b;
              return (
                <button
                  key={b.gender}
                  type="button"
                  onClick={() => setTab(i)}
                  className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${active ? 'border-gray-200 bg-surface text-blue-700 dark:border-gray-700 dark:text-blue-300' : 'border-transparent text-text-muted hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  {GENDER_LABEL[b.gender] ?? b.gender}
                </button>
              );
            })}
          </div>
        </div>

        {board ? (
          <section>
            <h2 className="mb-1 text-lg font-bold">{GENDER_LABEL[board.gender]} 強豪校ランキング</h2>
            <p className="mb-3 text-xs text-text-muted">
              対象 {board.outOf.toLocaleString()}校中の上位{Math.min(TOP_N, board.entries.length)}校。学校名から各校の全国大会成績ページへ移動できます。
            </p>
            <table className="w-full border border-border-strong text-sm">
              <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
                <tr>
                  <th className="py-1.5 px-2 text-center">順位</th>
                  <th className="py-1.5 px-2 text-left">学校</th>
                  <th className="py-1.5 px-2 text-left">都道府県</th>
                  <th className="py-1.5 px-2 text-center">ポイント</th>
                  <th className="py-1.5 px-2 text-left">主な成績</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((e) => (
                  <tr
                    key={`${board.gender}-${e.teamId}`}
                    className={`border-t border-border-strong ${e.rank <= 3 ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="py-1.5 px-2 text-center font-semibold">{e.rank}</td>
                    <td className="py-1.5 px-2">
                      <Link href={`/highschool/${e.gender}/${e.prefectureId}/${e.teamId}`} className="text-link hover:underline">
                        {e.team}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 text-text-secondary">
                      <Link href={`/highschool/${e.gender}/${e.prefectureId}`} className="hover:underline">
                        {e.prefecture}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 text-center">{e.points}</td>
                    <td className="py-1.5 px-2 text-xs text-text-secondary">
                      {[
                        e.winner > 0 ? `優勝${e.winner}` : null,
                        e.runnerup > 0 ? `準優勝${e.runnerup}` : null,
                        e.best4 > 0 ? `ベスト4×${e.best4}` : null,
                        e.best8 > 0 ? `ベスト8×${e.best8}` : null,
                      ]
                        .filter(Boolean)
                        .join('・') || `出場${e.appearances}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="text-sm text-text-muted">ランキングを算出できるデータがありません。</p>
        )}

        {/* 男女の上位10校(静的HTML)。タブ裏はクライアント描画でクローラに見えないため、
            学校名と内部リンクをここで担保する(seo.md #9 と同型)。 */}
        <section>
          <h2 className="mb-1 text-lg font-bold">男女別 上位校まとめ</h2>
          <p className="mb-4 text-xs text-text-muted">男子・女子それぞれの上位10校です。詳細は上の男女切替で確認できます。</p>
          <div className="space-y-4">
            {boards.map((b) => (
              <div key={`summary-${b.gender}`}>
                <h3 className="mb-1 text-base font-semibold">{GENDER_LABEL[b.gender]}</h3>
                <ul className="space-y-1 text-sm text-text-secondary">
                  {b.entries.slice(0, 10).map((e) => (
                    <li key={`summary-${b.gender}-${e.teamId}`}>
                      {e.rank}位{' '}
                      <Link href={`/highschool/${e.gender}/${e.prefectureId}/${e.teamId}`} className="text-link hover:underline">
                        {e.team}
                      </Link>
                      （{e.prefecture}・{e.points}pt）
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="text-right">
          <Link href="/highschool" className="text-sm text-link hover:underline">
            高校ソフトテニスのトップへ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const boards = buildSchoolRankingBoards(process.cwd(), TOP_N);
  return { props: { boards } };
};
