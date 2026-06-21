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
  type TeamLink,
  type TournamentRecords,
  type UpcomingEdition,
} from '@/lib/highschoolNationalTournaments';

type Props = {
  records: TournamentRecords;
};

/** 学校名を、学校ページが実在する場合のみリンク表示する（・区切り） */
function SchoolNames({ links }: { links: TeamLink[] }) {
  if (links.length === 0) {
    return <span className="font-normal text-gray-400">—</span>;
  }
  return (
    <>
      {links.map((t, i) => (
        <span key={`${t.name}-${i}`}>
          {i > 0 && '・'}
          {t.href ? (
            <Link
              href={t.href}
              className="text-blue-700 dark:text-blue-300 hover:underline"
            >
              {t.name}
            </Link>
          ) : (
            t.name
          )}
        </span>
      ))}
    </>
  );
}

/** 上位入賞の表示名。個人は「選手名（所属校リンク）」、団体は校名リンク。 */
function PlacementName({
  players,
  teamLinks,
}: {
  players: string[];
  teamLinks: TeamLink[];
}) {
  const nameStr = players.join('・');
  if (!nameStr) {
    return <SchoolNames links={teamLinks} />;
  }
  return (
    <>
      {nameStr}
      {teamLinks.length > 0 && (
        <>
          （<SchoolNames links={teamLinks} />）
        </>
      )}
    </>
  );
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate) return '';
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${Number(y)}年${Number(m)}月${Number(day)}日`;
  };
  if (!endDate || endDate === startDate) return fmt(startDate);
  const [, em, ed] = endDate.split('-');
  return `${fmt(startDate)}〜${Number(em)}月${Number(ed)}日`;
}

/** 次回大会（開催予定）の案内。結果が出る前から大会の存在を示す。 */
function UpcomingSection({
  editions,
  shortLabel,
  officialUrl,
}: {
  editions: UpcomingEdition[];
  shortLabel: string;
  officialUrl: string;
}) {
  if (editions.length === 0) return null;
  return (
    <section className="mb-10">
      {editions.map((ed) => {
        const dateRange = formatDateRange(ed.startDate, ed.endDate);
        return (
          <div
            key={ed.year}
            className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-bold">
                開催予定
              </span>
              <h2 className="text-lg font-bold">
                {ed.year}年 {shortLabel}
              </h2>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
              {dateRange && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">日程</dt>
                  <dd className="font-semibold">{dateRange}</dd>
                </div>
              )}
              {ed.location && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">開催地</dt>
                  <dd className="font-semibold">{ed.location}</dd>
                </div>
              )}
              {ed.categoryLabels.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">種目</dt>
                  <dd className="font-semibold">
                    {ed.categoryLabels.join('・')}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              結果が確定し次第、本ページの「年度別の記録」に追加します。
              最新情報は
              <a
                href={ed.sourceUrl || officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-300 hover:underline mx-0.5"
              >
                大会公式サイト
              </a>
              をご確認ください。
            </p>
          </div>
        );
      })}
    </section>
  );
}

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
    <section className="mb-12">
      <h2 className="text-xl font-bold mb-1">歴代優勝（種目別）</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        年度ごとの優勝を種目別に並べています。学校・都道府県の列を縦に見比べると、
        優勝の傾向を自分で確認できます。
      </p>

      <div className="space-y-6">
        {rows.map((row) => (
          <div
            key={row.categoryId}
            className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <h3 className="font-semibold px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              {row.label}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <caption className="sr-only">
                  {row.label}の歴代優勝（年度・学校・選手・都道府県）
                </caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-2 px-4 font-semibold w-16">年度</th>
                    <th className="py-2 px-4 font-semibold">学校</th>
                    <th className="py-2 px-4 font-semibold">選手・ペア</th>
                    <th className="py-2 px-4 font-semibold w-28">都道府県</th>
                  </tr>
                </thead>
                <tbody>
                  {row.byYear.map((cell) => (
                    <tr
                      key={`${row.categoryId}-${cell.year}`}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2.5 px-4 align-top whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400">
                        {cell.year}
                      </td>
                      <td className="py-2.5 px-4 align-top font-semibold">
                        <SchoolNames links={cell.teamLinks} />
                      </td>
                      <td className="py-2.5 px-4 align-top">
                        {cell.players.length > 0 ? (
                          cell.players.join('・')
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 align-top text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {cell.prefectures.length > 0
                          ? cell.prefectures.join('・')
                          : '—'}
                      </td>
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
    upcoming,
    lastModified,
    yearsCovered,
  } = records;

  const pageUrl = `https://softeni-pick.com/highschool/tournaments/${slug}/`;
  const yearRange = formatYearRange(yearsCovered);
  const titleName = label === shortLabel ? label : `${label}（${shortLabel}）`;
  const latestYear = yearsCovered.length ? Math.max(...yearsCovered) : null;
  const categoryCount = championSummary.length;
  const nextEdition = upcoming[0] ?? null;

  const faqItems = [
    ...(nextEdition
      ? [
          {
            question: `次回の${shortLabel}（${nextEdition.year}年）はいつ・どこで開催されますか？`,
            answer: `${nextEdition.year}年大会は${
              formatDateRange(nextEdition.startDate, nextEdition.endDate) ||
              '日程調整中'
            }${nextEdition.location ? `、${nextEdition.location}で` : ''}開催予定です。結果が確定次第このページに掲載します。`,
          },
        ]
      : []),
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
        title={`ソフトテニス ${titleName} 歴代優勝校・結果一覧${nextEdition ? `｜${nextEdition.year}年大会の開催予定` : ''}（${yearRange || '年度別'}） | ソフトテニス情報`}
        description={`ソフトテニス「${titleName}」の歴代優勝校・優勝ペアを年度別・種目別に一覧でまとめました。${yearRange ? `${yearRange}の` : ''}優勝・準優勝・ベスト4の上位入賞と都道府県、各年度の対戦表へのリンクを掲載。${
          nextEdition
            ? `${nextEdition.year}年大会は${formatDateRange(nextEdition.startDate, nextEdition.endDate) || '開催予定'}${nextEdition.location ? `（${nextEdition.location}）` : ''}。`
            : ''
        }`}
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `${titleName} 歴代優勝校・結果一覧`,
              description: `${titleName}の歴代優勝校・上位入賞（優勝〜ベスト4）を年度別・種目別にまとめたページ。`,
              url: pageUrl,
              inLanguage: 'ja',
              ...(lastModified ? { dateModified: lastModified } : {}),
              isPartOf: {
                '@type': 'WebSite',
                name: 'ソフトテニス情報',
                url: 'https://softeni-pick.com/',
              },
            }),
          }}
        />
        {upcoming.map((ed) => (
          <script
            key={`event-${ed.year}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SportsEvent',
                name: `${ed.year}年 ${titleName}`,
                sport: 'ソフトテニス',
                ...(ed.startDate ? { startDate: ed.startDate } : {}),
                ...(ed.endDate ? { endDate: ed.endDate } : {}),
                eventStatus: 'https://schema.org/EventScheduled',
                eventAttendanceMode:
                  'https://schema.org/OfflineEventAttendanceMode',
                ...(ed.location
                  ? {
                      location: {
                        '@type': 'Place',
                        name: ed.location,
                        address: {
                          '@type': 'PostalAddress',
                          addressRegion: ed.location,
                          addressCountry: 'JP',
                        },
                      },
                    }
                  : {}),
                organizer: {
                  '@type': 'Organization',
                  name: '公益財団法人日本ソフトテニス連盟',
                  url: 'https://www.jsta.or.jp/',
                },
                url: pageUrl,
              }),
            }}
          />
        ))}
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

        <header className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/80 dark:to-gray-900 p-6 sm:p-7">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {titleName} 歴代結果・優勝校一覧
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {description}
          </p>

          {(yearRange || categoryCount > 0) && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {yearRange && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    収録年度
                  </dt>
                  <dd className="font-semibold tabular-nums">{yearRange}</dd>
                </div>
              )}
              {categoryCount > 0 && (
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">
                    収録種目
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {categoryCount}種目
                  </dd>
                </div>
              )}
            </dl>
          )}

          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              大会公式サイト
              <span aria-hidden>↗</span>
            </a>
          )}
        </header>

        <UpcomingSection
          editions={upcoming}
          shortLabel={shortLabel}
          officialUrl={officialUrl}
        />

        <p className="mb-8 text-sm text-gray-600 dark:text-gray-300">
          {yearRange ? `${yearRange}にかけての` : ''}各年度・種目別に、
          優勝・準優勝・ベスト4の上位入賞をまとめています。
          気になる年度は「対戦表を見る」から全試合結果・トーナメント表へ進めます。
          学校名から各校の戦績ページへも移動できます。
        </p>

        {lastModified && (
          <p className="mb-8 -mt-4 text-xs text-gray-400 dark:text-gray-500">
            最終更新: {formatDateRange(lastModified, null)}
          </p>
        )}

        <ChampionSummary rows={championSummary} />

        {years.length === 0 ? (
          <p className="text-sm text-gray-500">
            現在、掲載中の結果データがありません。
          </p>
        ) : (
          <section>
            <h2 className="text-xl font-bold mb-1">年度別の記録</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              各年度の優勝〜ベスト4を種目別に掲載。新しい年度から並べています。
            </p>
            <div className="space-y-10">
              {years.map((yr) => (
                <section
                  key={yr.year}
                  className="scroll-mt-20"
                  id={`y${yr.year}`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-lg font-bold">
                      {yr.year}年度 {shortLabel}
                    </h3>
                    {latestYear === yr.year && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 px-2 py-0.5 text-xs font-semibold">
                        最新
                      </span>
                    )}
                  </div>
                  {(yr.location || yr.startDate) && (
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      {yr.location ? `開催地: ${yr.location}` : ''}
                      {yr.location && yr.startDate ? ' / ' : ''}
                      {yr.startDate
                        ? `日程: ${formatDateRange(yr.startDate, yr.endDate)}`
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
                                <PlacementName
                                  players={p.players}
                                  teamLinks={p.teamLinks}
                                />
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
