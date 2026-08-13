// src/pages/secondaryschool/[prefectureId]/index.tsx
// 中学カテゴリの都道府県ページ。
//
// 役割は「県内にどのチームが収録されているか」の一覧。**順位づけはしない**
// （県別ポイントは 2026-08-12 に廃止。大会ごとに県の出場枠が違い比較が成立しないため）。
// 中学校と地域クラブを分けて並べるのは実態が違うからで、優劣ではない。
// 仕様: docs/wiki/secondaryschool.md

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  describeResult,
  getPrefecture,
  getPrefectures,
  getTeamsByPrefecture,
  getThreshold,
  type SecondarySchoolPrefecture,
  type SecondarySchoolTeam,
} from '@/lib/secondaryschool';

interface Props {
  prefecture: SecondarySchoolPrefecture;
  teams: SecondarySchoolTeam[];
  threshold: number;
}

export default function SecondarySchoolPrefecturePage({ prefecture, teams, threshold }: Props) {
  const pageUrl = `https://softeni-pick.com/secondaryschool/${prefecture.id}/`;
  const schools = teams.filter((t) => t.kind === 'school');
  const clubs = teams.filter((t) => t.kind === 'club');
  const others = teams.filter((t) => t.kind === 'unknown');

  const renderTeams = (list: SecondarySchoolTeam[]) => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map((t) => (
        <li key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3">
          <Link href={`/secondaryschool/${prefecture.id}/${t.id}/`} className="font-semibold text-link hover:underline">
            {t.name}
          </Link>
          <p className="mt-0.5 text-xs text-text-muted">
            {t.best ? describeResult(t.best) : `収録${t.count}件`}
            {t.years.length > 0 && ` ／ ${t.years[0]}〜${t.years[t.years.length - 1]}年`}
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <MetaHead
        title={`${prefecture.name}の中学ソフトテニス | 全中・都道府県対抗の成績 | Softeni Pick`}
        description={`${prefecture.name}の中学ソフトテニス。全国中学校体育大会（全中）・都道府県対抗全日本中学生大会・ブロック大会に出場した${teams.length}チーム（中学校${schools.length}・地域クラブ${clubs.length}）の戦績と、中学から高校への進路をまとめています。`}
        url={pageUrl}
        type="website"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: `${prefecture.name}の中学ソフトテニス 収録チーム`,
              itemListElement: teams.slice(0, 20).map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: t.name,
                url: `https://softeni-pick.com/secondaryschool/${prefecture.id}/${t.id}/`,
              })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '中学', href: '/secondaryschool' },
            { label: prefecture.name, href: `/secondaryschool/${prefecture.id}` },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">{prefecture.name}の中学ソフトテニス</h1>
        <p className="mb-6 text-sm text-text-secondary">
          {prefecture.name}から全国中学校体育大会（全中）・都道府県対抗全日本中学生大会・ブロック大会に出場した{teams.length}
          チームの一覧です。チーム名から各チームの戦績と、その中学から高校への進路を見られます。
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">収録チーム（{teams.length}）</h2>
          <p className="mb-4 text-sm text-text-secondary">
            中学校{schools.length}・地域クラブ{clubs.length}
            {others.length > 0 && `・その他${others.length}`}。 2023年度から地域クラブ活動に所属する生徒も全中に出場できるようになったため、
            このカテゴリでは学校とクラブを分けずに扱っています。
          </p>

          {schools.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-base font-semibold">中学校</h3>
              {renderTeams(schools)}
            </div>
          )}
          {clubs.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-base font-semibold">地域クラブ</h3>
              {renderTeams(clubs)}
            </div>
          )}
          {others.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-base font-semibold">その他のチーム</h3>
              {renderTeams(others)}
            </div>
          )}

          <p className="mt-2 text-xs text-text-muted">
            個別ページは当サイト収録の出場が{threshold}回以上のチームに作成しています。
            {threshold}回未満のチームはここには表示されません。
          </p>
        </section>

        <p className="text-sm">
          <Link href="/secondaryschool/" className="text-link hover:underline">
            他の都道府県を見る
          </Link>
        </p>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  // 掲載チームが0件の県はページを作らない（空ページを増やさない）
  paths: getPrefectures()
    .filter((p) => p.teamCount > 0)
    .map((p) => ({ params: { prefectureId: p.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const { prefectureId } = context.params as { prefectureId: string };
  const prefecture = getPrefecture(prefectureId);
  if (!prefecture) return { notFound: true };
  return {
    props: {
      prefecture,
      teams: getTeamsByPrefecture(prefectureId),
      threshold: getThreshold(),
    },
  };
};
