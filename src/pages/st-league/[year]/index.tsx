import fs from 'fs';
import path from 'path';

import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { buildEventOrganizer, buildEventPlace, sportsEventBaseFields } from '@/lib/sportsEventJsonLd';
import { getDivisions, getStLeagueYears, loadLeagueMeta, LeagueMeta } from '@/utils/st-league';

interface ChampionPair {
  boys?: string;
  girls?: string;
}

interface Props {
  year: number;
  meta: LeagueMeta | null;
  divisionNames: string[];
  champions: ChampionPair;
}

// 年度ハブ（年度トップ）。
// 「STリーグ 2025」「第N回STリーグ 結果・会場」系クエリの受け皿。
// matches/teams/analysis とのカニバリを避けるため、本ページは
// 大会概要（会場・日程・形式）＋優勝チーム＋各サブページへの導線に限定し、
// 詳細な順位表・対戦結果は matches へ委譲する。
const SUBPAGES = [
  {
    id: 'matches',
    title: '試合結果・順位表',
    description: 'リーグ別の対戦結果・順位表・日程',
    colorClass: 'bg-green-500',
  },
  {
    id: 'teams',
    title: '出場チーム・選手',
    description: '出場全チームの年間成績と選手紹介',
    colorClass: 'bg-blue-500',
  },
  {
    id: 'analysis',
    title: 'データ・分析',
    description: '選手別スタッツと勝率ランキング',
    colorClass: 'bg-purple-500',
  },
] as const;

const GENDERS: { key: 'boys' | 'girls'; label: string; ring: string }[] = [
  { key: 'boys', label: '男子', ring: 'border-blue-200 dark:border-blue-800' },
  { key: 'girls', label: '女子', ring: 'border-pink-200 dark:border-pink-800' },
];

export default function STLeagueYearHub({ year, meta, divisionNames, champions }: Props) {
  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const pageTitle = `${editionLabel}｜結果・会場・優勝チーム | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/`;
  const dateRange = meta?.period ? `${meta.period.start.replace(/-/g, '/')}〜${meta.period.end.replace(/-/g, '/')}` : '';
  const championText = [champions.boys && `男子${champions.boys}`, champions.girls && `女子${champions.girls}`].filter(Boolean).join('、');
  const description = `${editionLabel}（${dateRange}${meta?.venue ? ` / ${meta.venue}` : ''}）の大会概要・会場・優勝チームのまとめ。${championText ? `${championText}が優勝。` : ''}試合結果・順位表・出場チーム・選手データへのリンクをまとめています。`;

  return (
    <>
      <MetaHead title={pageTitle} description={description} url={pageUrl} />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: editionLabel,
              sport: 'ソフトテニス',
              ...sportsEventBaseFields,
              ...(meta?.period && {
                startDate: meta.period.start,
                endDate: meta.period.end ?? meta.period.start,
              }),
              location: buildEventPlace(meta?.venue, meta?.location),
              organizer: buildEventOrganizer('公益財団法人 日本ソフトテニス連盟', 'https://www.jsta.or.jp/'),
              description: `${editionLabel}の大会概要・会場・優勝チーム。`,
              url: pageUrl,
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl" className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year}`, href: `/st-league/${year}` },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">{editionLabel} 大会概要</h1>
          {(dateRange || meta?.venue) && (
            <p className="text-sm text-gray-500 mt-1">
              {dateRange}
              {meta?.venue && `　${meta.venue}`}
              {meta?.location && `（${meta.location}）`}
            </p>
          )}
          <p className="mt-2 text-text-secondary leading-relaxed">
            <strong>{editionLabel}</strong>
            の開催概要・会場・優勝チームをまとめたページです。男女・リーグ別の 詳しい試合結果や順位表、出場チーム・選手データは下記の各ページから確認できます。
          </p>
        </header>

        {/* 優勝チーム */}
        {(champions.boys || champions.girls) && (
          <section>
            <h2 className="text-lg font-bold mb-3">優勝チーム（STリーグⅠ）</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {GENDERS.map(({ key, label, ring }) => (
                <div key={key} className={`bg-surface rounded-xl p-5 border ${ring} shadow-sm`}>
                  <div className="text-xs font-semibold text-text-muted mb-1">{label}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500" aria-hidden>
                      🏆
                    </span>
                    <span className="font-bold text-lg">{champions[key] ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">
              <Link href="/st-league/champions" className="text-primary font-semibold hover:underline">
                ▶ 歴代優勝チーム・記録（連覇・昇降格の系譜）を見る
              </Link>
            </p>
          </section>
        )}

        {/* 大会概要 */}
        <section>
          <h2 className="text-lg font-bold mb-3">開催概要</h2>
          <dl className="bg-surface rounded-xl border border-border shadow-sm divide-y divide-border text-sm">
            {meta?.edition && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">開催回</dt>
                <dd className="font-medium">第{meta.edition}回</dd>
              </div>
            )}
            {dateRange && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">日程</dt>
                <dd className="font-medium">{dateRange}</dd>
              </div>
            )}
            {(meta?.venue || meta?.location) && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">会場</dt>
                <dd className="font-medium">
                  {meta?.venue}
                  {meta?.location && `（${meta.location}）`}
                </dd>
              </div>
            )}
            {divisionNames.length > 0 && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">リーグ構成</dt>
                <dd className="font-medium">{divisionNames.join('・')}</dd>
              </div>
            )}
            {meta?.format?.tie && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">対戦形式</dt>
                <dd className="font-medium">{meta.format.tie}</dd>
              </div>
            )}
            {meta?.format?.game && (
              <div className="flex px-4 py-3">
                <dt className="w-28 shrink-0 text-text-muted">ゲーム形式</dt>
                <dd className="font-medium">{meta.format.game}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* 各サブページ導線 */}
        <section>
          <h2 className="text-lg font-bold mb-3">{year}年度の詳細データ</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SUBPAGES.map((item) => (
              <Link
                key={item.id}
                href={`/st-league/${year}/${item.id}`}
                className="bg-surface rounded-xl shadow-sm p-6 border border-border relative overflow-hidden group hover:shadow-md transition block focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <div className={`absolute top-0 right-0 w-2 h-full ${item.colorClass} opacity-80`} />
                <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* プレーオフ案内 */}
        {meta?.playoff && (
          <section className="bg-warning-bg border border-warning-border rounded-xl p-5">
            <h2 className="font-bold text-warning mb-1">{meta.playoff.name}</h2>
            {meta.playoff.period && (
              <p className="text-sm text-warning">
                {meta.playoff.period.start.replace(/-/g, '/')}〜{meta.playoff.period.end.replace(/-/g, '/')}
                {meta.playoff.venue && `　${meta.playoff.venue}`}
              </p>
            )}
            {meta.playoff.description && <p className="text-sm text-warning mt-1">{meta.playoff.description}</p>}
          </section>
        )}

        {/* 他ページ導線 */}
        <nav className="flex flex-wrap gap-4 pt-2 border-t border-border">
          <Link href="/st-league" className="text-primary font-semibold hover:underline">
            ◀ STリーグ トップ（他の開催年度）
          </Link>
          <Link href="/st-league/about" className="text-primary font-semibold hover:underline">
            ▶ ルール・仕組みを詳しく見る
          </Link>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticPaths = async () => ({
  paths: getStLeagueYears().map((y) => ({ params: { year: String(y) } })),
  fallback: false,
});

interface EditionsFile {
  editions?: {
    year: number;
    champions?: { boys?: string; girls?: string };
  }[];
}

export const getStaticProps = async ({ params }: { params: { year: string } }) => {
  const year = params.year;
  const meta = loadLeagueMeta(year);
  if (!meta) return { notFound: true };

  // 試合データを持つ部のみ構成として表示（Ⅲ部など hasMatchData:false は除外）
  const divisionNames = getDivisions(meta).map((d) => d.name);

  // 優勝チームは editions.json（表示名）から取得。champions ページと表記を統一する。
  let champions: ChampionPair = {};
  const editionsPath = path.join(process.cwd(), 'data/st-league/editions.json');
  if (fs.existsSync(editionsPath)) {
    const parsed: EditionsFile = JSON.parse(fs.readFileSync(editionsPath, 'utf8'));
    const row = parsed.editions?.find((e) => e.year === parseInt(year, 10));
    champions = {
      boys: row?.champions?.boys ?? undefined,
      girls: row?.champions?.girls ?? undefined,
    };
  }

  return {
    props: {
      year: parseInt(year, 10),
      meta,
      divisionNames,
      champions,
    },
  };
};
