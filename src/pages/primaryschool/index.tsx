// src/pages/primaryschool/index.tsx
// 小学生カテゴリの入口。47都道府県への導線が主目的。
//
// 「小学校」とは呼ばない。掲載団体の実体はほぼ全部がクラブ・少年団で、
// `小学校` / `小` で終わる団体は0件だった（docs/wiki/primaryschool.md）。
//
// 中学（/secondaryschool）と同じく、性別をURLに入れず、大会軸のページも作らず（ADR-010）、
// 順位づけをする節も持たない。対象大会は全日本小学生選手権の1つだけ。

import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { countPathways, countTeamsWithPathways, getPrefectures, getThreshold, type PrimarySchoolPrefecture } from '@/lib/primaryschool';

/** 全日本小学生選手権の大会ハブ。大会軸はこちらへ寄せる（新規に歴代ページを作らない） */
const ZENNIHON_HUB = '/tournaments/junior/zennihon-primaryschool/';

interface Props {
  prefectures: PrimarySchoolPrefecture[];
  threshold: number;
  teamTotal: number;
  pathwayTotal: number;
  pathwayTeams: number;
}

export default function PrimarySchoolIndex({ prefectures, threshold, teamTotal, pathwayTotal, pathwayTeams }: Props) {
  const pageUrl = 'https://softeni-pick.com/primaryschool/';
  const regions = [...new Set(prefectures.map((p) => p.region))];

  return (
    <>
      <MetaHead
        title="小学生ソフトテニス | 全日本小学生選手権の成績と進路 | Softeni Pick"
        description={`小学生ソフトテニスの特集ページ。全日本小学生選手権大会の成績を都道府県別・団体別にまとめています。収録${teamTotal}団体、小学生から中学への進路${pathwayTotal}件を掲載。`}
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '小学生', href: '/primaryschool' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">小学生ソフトテニス</h1>
        <p className="mb-6 text-sm text-text-secondary">
          全日本小学生選手権大会の結果から、都道府県ごとの収録団体と戦績をまとめています。収録は{teamTotal}団体。
          出場しているのはクラブ・スポーツ少年団が中心なので、このカテゴリでは学校名ではなく
          <strong className="font-semibold">団体名</strong>で扱っています。
        </p>

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <Link href={ZENNIHON_HUB} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle">
            <h2 className="text-base font-semibold text-text">全日本小学生選手権大会の結果</h2>
            <p className="text-xs text-text-muted">年度別の対戦表と優勝者</p>
          </Link>
          <Link href="/secondaryschool/" className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle">
            <h2 className="text-base font-semibold text-text">中学ソフトテニス</h2>
            <p className="text-xs text-text-muted">
              進学先。各中学のページに「出身クラブ」を載せています（小学生{pathwayTeams}団体から{pathwayTotal}名）
            </p>
          </Link>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">都道府県から探す</h2>
          {regions.map((region) => (
            <div key={region} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-text-secondary">{region}</h3>
              <ul className="flex flex-wrap gap-2">
                {prefectures
                  .filter((p) => p.region === region)
                  .map((p) => (
                    <li key={p.id}>
                      {p.teamCount > 0 ? (
                        <Link
                          href={`/primaryschool/${p.id}/`}
                          className="inline-block rounded-full bg-info-bg px-3 py-1 text-sm text-info transition hover:opacity-80"
                        >
                          {p.name}
                          <span className="ml-1 text-xs text-text-muted">{p.teamCount}</span>
                        </Link>
                      ) : (
                        <span className="inline-block rounded-full bg-bg-subtle px-3 py-1 text-sm text-text-muted">{p.name}（収録準備中）</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <p className="mt-4 text-xs text-text-muted">
            都道府県名の横の数字は収録団体の数です。個別ページは当サイト収録の出場が{threshold}回以上の団体に作成しています。
          </p>
        </section>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const prefectures = getPrefectures();
  return {
    props: {
      prefectures,
      threshold: getThreshold(),
      teamTotal: prefectures.reduce((n, p) => n + p.teamCount, 0),
      pathwayTotal: countPathways(),
      pathwayTeams: countTeamsWithPathways(),
    },
  };
};
