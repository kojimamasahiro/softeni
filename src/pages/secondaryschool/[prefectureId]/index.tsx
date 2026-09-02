// src/pages/secondaryschool/[prefectureId]/index.tsx
// 中学カテゴリの都道府県ページ。
//
// 役割は「県内にどのチームが収録されているか」の一覧。**順位づけはしない**
// （県別ポイントは 2026-08-12 に廃止。大会ごとに県の出場枠が違い比較が成立しないため）。
//
// **中学校 / 地域クラブ / その他 の3見出しに分けるのをやめた**（2026-08-13）。
// 分類（lib/clubTransition.ts）は「積極的な証拠があるときだけクラブと判定する」下限カウントで、
// 判定できないチームが16%（47/293）ある。見出しの構造に使うと、その47件が
// 「その他」として前面に出てしまい、しかも導入文の「区別せず扱っています」と食い違う。
// 分類の本来の用途は全中ハブの地域移行トラッカーで、そちらは無傷。
// ここでは**分かるときだけ小さなラベルで添える**（unknown は何も出さない）。
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
  teamKindLabel,
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
  const renderTeams = (list: SecondarySchoolTeam[]) => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {list.map((t) => (
        <li key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/secondaryschool/${prefecture.id}/${t.id}/`} className="font-semibold text-link hover:underline">
              {t.name}
            </Link>
            {/* 判定できたときだけ添える。unknown は何も出さない */}
            {t.kind !== 'unknown' && <span className="text-xs text-text-muted">{teamKindLabel(t.kind)}</span>}
          </span>
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
        description={`${prefecture.name}の中学ソフトテニス。全国中学校大会（全中）・都道府県対抗全日本中学生大会・ブロック大会に出場した${teams.length}チームの戦績と、中学から高校への進路をまとめています。`}
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
          {prefecture.name}から全国中学校大会（全中）・都道府県対抗全日本中学生大会・ブロック大会に出場した{teams.length}
          チームの一覧です。チーム名から各チームの戦績と、その中学から高校への進路を見られます。
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">収録チーム（{teams.length}）</h2>
          <p className="mb-4 text-sm text-text-secondary">
            2023年度から地域クラブ活動に所属する生徒も全中に出場できるようになったため、
            このカテゴリでは学校とクラブを分けずに扱っています。出場回数の多い順に並べています。
          </p>

          {renderTeams(teams)}

          <p className="mt-4 text-xs text-text-muted">
            個別ページは当サイト収録の出場が{threshold}回以上のチームに作成しています。
            {threshold}回未満のチームはここには表示されません。
          </p>
        </section>

        {/* 同じ県の高校ページへの相互リンク。prefectureId は中学・高校で47件すべて共通で、
            高校の県ページは男女とも47県ぶん必ず存在するのでデッドリンクにならない */}
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-bold">{prefecture.name}の高校ソフトテニス</h2>
          <p className="mb-3 text-sm text-text-secondary">
            進学先を調べるときに使えます。インターハイ・ハイスクールジャパンカップ・全日本高校選抜での{prefecture.name}の成績を学校別にまとめています。
          </p>
          <div className="flex gap-2">
            <Link href={`/highschool/boys/${prefecture.id}/`} className="rounded-full bg-info-bg px-4 py-1.5 text-sm text-info transition hover:opacity-80">
              {prefecture.name}の高校男子
            </Link>
            <Link href={`/highschool/girls/${prefecture.id}/`} className="rounded-full bg-info-bg px-4 py-1.5 text-sm text-info transition hover:opacity-80">
              {prefecture.name}の高校女子
            </Link>
          </div>
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
