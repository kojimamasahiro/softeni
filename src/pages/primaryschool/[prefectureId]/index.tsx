// src/pages/primaryschool/[prefectureId]/index.tsx
// 小学生カテゴリの都道府県ページ。
//
// 役割は「県内にどの団体が収録されているか」の一覧。**順位づけはしない**。
// 全日本小学生選手権は47都道府県が毎年すべて出場し、開催県以外は全県4ペア枠という
// サイト内で最も規則正しいデータだが、それでもポイント化はしない
// （中学が県別ポイントを廃止した理由＝配点が Assumption になる、がそのまま当てはまる）。
// 2026-09-13 に「全国大会での成績（ベスト8以上）」節を足した。県内の記録の列挙だけで、県同士は比べない。
// 仕様: docs/wiki/primaryschool.md

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import PrefectureAchievements, { formatYearRanges } from '@/components/PrefectureAchievements';
import {
  describeResult,
  getPrefecture,
  getPrefectureAchievementGroups,
  getPrefectures,
  getTeamsByPrefecture,
  getThreshold,
  type PrimarySchoolPrefecture,
  type PrimarySchoolTeam,
} from '@/lib/primaryschool';
import type { AchievementGroup } from '@/types/prefectureAchievements';

interface Props {
  prefecture: PrimarySchoolPrefecture;
  teams: PrimarySchoolTeam[];
  threshold: number;
  achievementGroups: AchievementGroup[];
}

export default function PrimarySchoolPrefecturePage({ prefecture, teams, threshold, achievementGroups }: Props) {
  const pageUrl = `https://softeni-pick.com/primaryschool/${prefecture.id}/`;
  const achievementYears = formatYearRanges(achievementGroups[0]?.years ?? []);

  return (
    <>
      <MetaHead
        title={`${prefecture.name}の小学生ソフトテニス | 全日本小学生選手権の成績 | Softeni Pick`}
        description={`${prefecture.name}の小学生ソフトテニス。全日本小学生選手権大会での${prefecture.name}のベスト8以上の成績、出場した${teams.length}団体の戦績、小学生から中学への進路をまとめています。`}
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
              name: `${prefecture.name}の小学生ソフトテニス 収録団体`,
              itemListElement: teams.slice(0, 20).map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: t.name,
                url: `https://softeni-pick.com/primaryschool/${prefecture.id}/${t.id}/`,
              })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '小学生', href: '/primaryschool' },
            { label: prefecture.name, href: `/primaryschool/${prefecture.id}` },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">{prefecture.name}の小学生ソフトテニス</h1>
        <p className="mb-6 text-sm text-text-secondary">
          {prefecture.name}から全日本小学生選手権大会に出場した{teams.length}
          団体の一覧です。団体名から各団体の戦績と、そこから中学への進路を見られます。
        </p>

        <PrefectureAchievements
          prefectureName={prefecture.name}
          groups={achievementGroups}
          note={`全日本小学生選手権大会（収録 ${achievementYears}）で、${prefecture.name}の選手がベスト8以上に入った記録です。都道府県の代表として出場する大会なので、所属クラブが異なるペアも${prefecture.name}の成績に含めています。`}
        />

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">収録団体（{teams.length}）</h2>
          <p className="mb-4 text-sm text-text-secondary">出場回数の多い順に並べています。</p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {teams.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                <Link href={`/primaryschool/${prefecture.id}/${t.id}/`} className="font-semibold text-link hover:underline">
                  {t.name}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">
                  {t.best ? describeResult(t.best) : `収録${t.count}件`}
                  {t.years.length > 0 && ` ／ ${t.years[0]}〜${t.years[t.years.length - 1]}年`}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-text-muted">
            個別ページは当サイト収録の出場が{threshold}回以上の団体に作成しています。
            {threshold}回未満の団体はここには表示されません。
          </p>
        </section>

        {/* 同じ県の中学ページへの相互リンク。prefectureId は小学・中学で共通。
            中学の県ページは掲載チーム0件の県を作らないが、現状47県すべて非空 */}
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-bold">{prefecture.name}の中学ソフトテニス</h2>
          <p className="mb-3 text-sm text-text-secondary">
            進学先を調べるときに使えます。各中学のページには、その中学の選手がどの小学生クラブから来ているかを載せています。
          </p>
          <Link
            href={`/secondaryschool/${prefecture.id}/`}
            className="inline-block rounded-full bg-info-bg px-4 py-1.5 text-sm text-info transition hover:opacity-80"
          >
            {prefecture.name}の中学
          </Link>
        </section>

        <p className="text-sm">
          <Link href="/primaryschool/" className="text-link hover:underline">
            他の都道府県を見る
          </Link>
        </p>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  // 掲載団体が0件の県はページを作らない（空ページを増やさない）
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
      achievementGroups: getPrefectureAchievementGroups(prefectureId),
    },
  };
};
