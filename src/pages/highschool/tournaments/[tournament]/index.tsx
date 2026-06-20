// pages/highschool/tournaments/[tournament]/index.tsx
// 高校カテゴリ「全国大会 歴代記録」: 大会ごとの年度別・種目別の上位入賞（優勝〜ベスト4）。
// 都道府県別・学校別ページとは別に、代表的な全国大会そのものを軸にした回遊ページ。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  getHsNationalTournamentRecords,
  HS_NATIONAL_SLUGS,
  HS_NATIONAL_TOURNAMENTS,
  type ChampionSummaryRow,
  type HsNationalTournamentSlug,
  type TournamentRecords,
} from '@/lib/highschoolNationalTournaments';

type Props = {
  records: TournamentRecords;
};

const RANK_BADGE_CLASS: Record<string, string> = {
  優勝: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  準優勝: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  ベスト4: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
};

function formatYearRange(years: number[]): string {
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}年` : `${min}〜${max}年`;
}

function ChampionSummary({ rows }: { rows: ChampionSummaryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3">歴代優勝（種目別）</h2>
      <div className="space-y-5">
        {rows.map((row) => (
          <div key={row.categoryId}>
            <h3 className="font-semibold mb-2">{row.label}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    <th className="py-2 pr-3 font-semibold w-20">年度</th>
                    <th className="py-2 pr-3 font-semibold">優勝</th>
                  </tr>
                </thead>
                <tbody>
                  {row.byYear.map((cell) => (
                    <tr
                      key={`${row.categoryId}-${cell.year}`}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {cell.year}年
                      </td>
                      <td className="py-2 pr-3 align-top">{cell.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HighschoolTournamentRecordsPage({ records }: Props) {
  const {
    slug,
    label,
    shortLabel,
    officialUrl,
    description,
    years,
    championSummary,
    yearsCovered,
  } = records;

  const pageUrl = `https://softeni-pick.com/highschool/tournaments/${slug}/`;
  const yearRange = formatYearRange(yearsCovered);
  const titleName = label === shortLabel ? label : `${label}（${shortLabel}）`;

  const faqItems = [
    {
      question: `${shortLabel}の歴代優勝校・優勝ペアはどこで分かりますか？`,
      answer: `このページで年度別・種目別に優勝〜ベスト4の上位入賞をまとめています。${yearRange ? `${yearRange}の` : ''}結果を確認できます。`,
    },
    {
      question: '都道府県別・学校別のページとの違いは何ですか？',
      answer:
        '都道府県・学校別ページは「その学校が各大会でどこまで勝ち上がったか」を学校視点でまとめています。このページは大会そのものを軸に、各年度の上位入賞者を横断的に確認できます。',
    },
    {
      question: '対戦表（トーナメント表）も見られますか？',
      answer:
        '各種目の「対戦表を見る」リンクから、その年度・種目の全試合結果・トーナメント表ページへ移動できます。',
    },
  ];

  const championRows = championSummary.flatMap((row) =>
    row.byYear.map((cell) => ({
      year: cell.year,
      categoryLabel: row.label,
      winner: cell.winner as string,
    })),
  );

  return (
    <>
      <MetaHead
        title={`${titleName} 歴代結果・優勝〜ベスト4まとめ | ソフトテニス情報`}
        description={`ソフトテニス「${titleName}」の歴代結果を年度別・種目別に掲載。${yearRange ? `${yearRange}の` : ''}優勝・準優勝・ベスト4の上位入賞校／ペアと、各年度の対戦表へのリンクを確認できます。`}
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
                  item: 'https://softeni-pick.com/highschool/tournaments/',
                },
                {
                  '@type': 'ListItem',
                  position: 4,
                  name: titleName,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
        {championRows.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${titleName} 歴代優勝者`,
                numberOfItems: championRows.length,
                itemListElement: championRows.map((r, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: `${r.year}年 ${r.categoryLabel}`,
                  description: `優勝: ${r.winner}`,
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
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.answer,
                },
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
            { label: titleName, href: `/highschool/tournaments/${slug}` },
          ]}
        />

        <h1 className="text-2xl font-bold mb-3">{titleName} 歴代結果</h1>

        <div className="mb-6 space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>{description}</p>
          <p>
            {yearRange ? `${yearRange}にかけての` : ''}各年度・種目別に、
            優勝・準優勝・ベスト4の上位入賞をまとめています。
            気になる年度は「対戦表を見る」から全試合結果・トーナメント表へ進めます。
          </p>
          {officialUrl && (
            <p>
              大会公式サイト:{' '}
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-300 hover:underline"
              >
                {officialUrl}
              </a>
            </p>
          )}
        </div>

        <ChampionSummary rows={championSummary} />

        {years.length === 0 ? (
          <p className="text-sm text-gray-500">
            現在、掲載中の結果データがありません。
          </p>
        ) : (
          <section>
            <h2 className="text-xl font-semibold mb-4">年度別の記録</h2>
            <div className="space-y-10">
              {years.map((yr) => (
                <section key={yr.year}>
                  <h3 className="text-lg font-bold mb-1">
                    {yr.year}年度 {shortLabel}
                  </h3>
                  {(yr.location || yr.startDate) && (
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      {yr.location ? `開催地: ${yr.location}` : ''}
                      {yr.location && yr.startDate ? ' / ' : ''}
                      {yr.startDate
                        ? `日程: ${yr.startDate}${yr.endDate ? `〜${yr.endDate}` : ''}`
                        : ''}
                    </p>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {yr.categories.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h4 className="font-semibold">{cat.label}</h4>
                          <Link
                            href={cat.bracketHref}
                            className="text-xs text-blue-600 dark:text-blue-300 hover:underline whitespace-nowrap"
                          >
                            対戦表を見る
                          </Link>
                        </div>
                        <ul className="space-y-2">
                          {cat.placements.map((p, idx) => (
                            <li
                              key={`${cat.categoryId}-${p.order}-${idx}`}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                  RANK_BADGE_CLASS[p.rankLabel] ??
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100'
                                }`}
                              >
                                {p.rankLabel}
                              </span>
                              <span className="flex-1">
                                {p.display}
                                {p.prefectures.length > 0 && (
                                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                    {p.prefectures.join('・')}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-xl font-semibold mb-4">よくある質問</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <h3 className="font-semibold mb-2">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link
            href="/highschool/tournaments/"
            className="text-blue-600 dark:text-blue-300 hover:underline"
          >
            ← 全国大会の歴代記録 一覧へ
          </Link>
          <Link
            href="/highschool/boys/"
            className="text-blue-600 dark:text-blue-300 hover:underline"
          >
            高校 都道府県別ページへ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: HS_NATIONAL_SLUGS.map((slug) => ({ params: { tournament: slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const tournament = context.params?.tournament as HsNationalTournamentSlug;
  if (!tournament || !(tournament in HS_NATIONAL_TOURNAMENTS)) {
    return { notFound: true };
  }
  const records = getHsNationalTournamentRecords(tournament);
  return { props: { records } };
};
