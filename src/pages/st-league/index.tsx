import fs from 'fs';
import path from 'path';

import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getStLeagueYears, loadLeagueMeta } from '@/utils/st-league';

interface EditionCard {
  year: number;
  edition?: number;
  title: string;
  period?: string;
  venue?: string;
  divisionNames: string[];
}

interface DivisionOverview {
  id: string;
  name: string;
  rank: number;
  note?: string;
}

interface EditionsFile {
  overview?: {
    organizer?: string;
    structure?: string;
    predecessor?: string;
  };
}

interface Props {
  editions: EditionCard[];
  overview: EditionsFile['overview'] | null;
  divisionOverview: DivisionOverview[];
}

const menuItems = [
  {
    id: 'teams',
    title: '出場チーム・選手',
    description: '出場全チームの戦力分析と選手紹介',
    colorClass: 'bg-blue-500',
  },
  {
    id: 'matches',
    title: '試合結果・順位表',
    description: 'リーグ別の対戦結果・順位表・日程',
    colorClass: 'bg-green-500',
  },
  {
    id: 'data',
    title: 'データ・分析',
    description: '選手別スタッツと勝率ランキング',
    colorClass: 'bg-purple-500',
  },
] as const;

function hrefFor(id: string, year: number) {
  if (id === 'teams') return `/st-league/${year}/teams`;
  if (id === 'matches') return `/st-league/${year}/matches`;
  return `/st-league/${year}/analysis`;
}

export default function STLeagueHub({
  editions,
  overview,
  divisionOverview,
}: Props) {
  const pageTitle = 'STリーグ｜結果・順位表・出場チーム | ソフトテニス情報';
  const pageUrl = 'https://softeni-pick.com/st-league';

  return (
    <>
      <MetaHead
        title={pageTitle}
        description="ソフトテニス実業団最高峰「STリーグ」(Ⅰ・Ⅱ・Ⅲ部)の結果・順位表・出場チーム・選手データ。各年度の試合結果や昇格・降格(入替戦)情報をまとめています。"
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'STリーグ 開催年度一覧',
              itemListElement: editions.map((e, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: e.title,
                url: `https://softeni-pick.com/st-league/${e.year}/matches`,
              })),
            }),
          }}
        />
      </Head>
      <PageLayout maxWidth="6xl">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'STリーグ', href: '/st-league' },
            ]}
          />
        </div>

        {/* 紹介 */}
        <section className="max-w-3xl mx-auto mb-10 px-4">
          <h1 className="text-2xl font-bold mb-4">STリーグとは</h1>
          <p className="text-lg leading-relaxed mb-4">
            <strong>STリーグ</strong>
            は、日本のソフトテニス実業団チームによる最高峰のリーグ戦です。
            {overview?.predecessor && `（${overview.predecessor}）`}
            男女それぞれが
            <strong>STリーグⅠ・Ⅱ・Ⅲ</strong>
            の階層に分かれて総当たり戦を行い、年度成績に応じてプレーオフ（入替戦）で昇格・降格が決まります。
          </p>
          <Link
            href="/st-league/about"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ルール・仕組みを詳しく見る
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </section>

        {/* リーグ構成の概要 */}
        {divisionOverview.length > 0 && (
          <section className="max-w-4xl mx-auto mb-12 px-4">
            <h2 className="text-lg font-bold mb-4">リーグ構成</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {divisionOverview.map((d) => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">
                      {d.rank}
                    </span>
                    <span className="font-bold">{d.name}</span>
                  </div>
                  {d.note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {d.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              ※
              上位・下位リーグ間ではプレーオフ（入替戦）により昇格・降格が行われます。
            </p>
          </section>
        )}

        {/* 年度ごとのブロック */}
        <div className="max-w-4xl mx-auto">
          <section className="mb-8 px-4">
            <h2 className="text-lg font-bold mb-4">開催年度</h2>
            <div className="space-y-10">
              {editions.map((ed) => (
                <div
                  key={ed.year}
                  className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm overflow-hidden"
                >
                  <div className="relative z-10">
                    <span className="inline-block bg-blue-100 text-blue-800 text-s font-bold px-2 py-1 rounded">
                      {ed.edition ? `第${ed.edition}回` : `SEASON ${ed.year}`}
                    </span>
                    <h3 className="mt-2 text-xl font-bold">{ed.title}</h3>
                    {(ed.period || ed.venue) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {ed.period}
                        {ed.venue && `　${ed.venue}`}
                      </p>
                    )}
                    {ed.divisionNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ed.divisionNames.map((n) => (
                          <span
                            key={n}
                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 text-9xl font-bold text-gray-100 dark:text-gray-700/50 select-none">
                    {ed.year}
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    {menuItems.map((item) => (
                      <Link
                        key={item.id}
                        href={hrefFor(item.id, ed.year)}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition block focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <div
                          className={`absolute top-0 right-0 w-2 h-full ${item.colorClass} opacity-80`}
                        />
                        <h4 className="text-lg font-bold mb-2 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {item.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {editions.length === 0 && (
                <p className="text-gray-500">開催年度の情報がありません。</p>
              )}
            </div>
          </section>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps = async () => {
  const years = getStLeagueYears();

  const editions: EditionCard[] = years.map((year) => {
    const meta = loadLeagueMeta(year);
    const divs = (meta?.divisions ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank);
    return {
      year,
      edition: meta?.edition ?? null,
      title: meta?.title ?? `STリーグ ${year}`,
      period: meta?.period
        ? `${meta.period.start.replace(/-/g, '/')}〜${meta.period.end.replace(/-/g, '/')}`
        : null,
      venue: meta?.venue ?? null,
      divisionNames: divs.map((d) => d.name),
    } as EditionCard;
  });

  // 最新年度の division 構成を概要として使う
  let divisionOverview: DivisionOverview[] = [];
  const latest = years[0];
  if (latest) {
    const meta = loadLeagueMeta(latest);
    divisionOverview = (meta?.divisions ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((d) => ({
        id: d.id,
        name: d.name,
        rank: d.rank,
        note: d.note ?? null,
      })) as DivisionOverview[];
  }

  let overview: EditionsFile['overview'] | null = null;
  const editionsPath = path.join(process.cwd(), 'data/st-league/editions.json');
  if (fs.existsSync(editionsPath)) {
    const parsed: EditionsFile = JSON.parse(
      fs.readFileSync(editionsPath, 'utf8'),
    );
    overview = parsed.overview ?? null;
  }

  return { props: { editions, overview, divisionOverview } };
};
