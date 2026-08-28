// src/pages/secondaryschool/index.tsx
// 中学カテゴリの入口。47都道府県への導線が主目的。
//
// 高校（/highschool）と違い男女の入口を分けない。中学は1チームあたりの収録が
// 中央値8件しかなく、男女で割ると32%が5件未満になるため（docs/wiki/secondaryschool.md）。
// 大会軸のページも作らない。全中は既存の大会ハブがあり、そこに寄せる（ADR-010）。
// 県別のポイント・順位も持たない（2026-08-12 廃止。docs/wiki/secondaryschool.md）。
// このカテゴリの役割は「収録チームの名鑑＋進路」で、順位づけはしない。

import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { countPathways, countTeamsWithPathways, getPrefectures, getThreshold, type SecondarySchoolPrefecture } from '@/lib/secondaryschool';

/** 全中の大会ハブ。中学の大会軸はこちらへ寄せる（新規に歴代ページを作らない） */
const ZENCHU_HUB = '/tournaments/junior/secondaryschool-championship/';

interface Props {
  prefectures: SecondarySchoolPrefecture[];
  threshold: number;
  teamTotal: number;
  pathwayTotal: number;
  pathwayTeams: number;
}

export default function SecondarySchoolIndex({ prefectures, threshold, teamTotal, pathwayTotal, pathwayTeams }: Props) {
  const pageUrl = 'https://softeni-pick.com/secondaryschool/';
  const regions = [...new Set(prefectures.map((p) => p.region))];

  return (
    <>
      <MetaHead
        title="中学ソフトテニス | 全中・都道府県対抗の成績と進路 | Softeni Pick"
        description={`中学ソフトテニスの特集ページ。全国中学校大会（全中）・都道府県対抗全日本中学生大会・各ブロック大会の成績を都道府県別・チーム別にまとめています。収録${teamTotal}チーム、中学から高校への進路${pathwayTotal}件を掲載。`}
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '中学', href: '/secondaryschool' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">中学ソフトテニス</h1>
        <p className="mb-6 text-sm text-text-secondary">
          全国中学校大会（全中）・都道府県対抗全日本中学生大会・各地区のブロック大会の結果から、 都道府県ごとの成績と出場チームの戦績をまとめています。収録は
          {teamTotal}チーム。
          <strong className="font-semibold">部活動の地域移行にともない地域クラブの出場が増えている</strong>ため、
          このカテゴリでは学校とクラブを区別せず「チーム」として扱っています。
        </p>

        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          <Link href={ZENCHU_HUB} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle">
            <h2 className="text-base font-semibold text-text">全国中学校大会（全中）の結果</h2>
            <p className="text-xs text-text-muted">年度別の対戦表・優勝者と、学校部活動と地域クラブの内訳</p>
          </Link>
          {/* 進路一覧は男女別URLだが、入口では分けず男子へ送る（全中カードと同じ1枚のリンク）。
              女子へはリンク先ページの性別トグルで移動できる */}
          <Link
            href="/secondaryschool/pathways/boys/"
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle"
          >
            <h2 className="text-base font-semibold text-text">高校別の出身中学</h2>
            <p className="text-xs text-text-muted">
              どの高校がどの中学から選手を集めているか。中学{pathwayTeams}チームから進学した{pathwayTotal}名を掲載
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
                          href={`/secondaryschool/${p.id}/`}
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
            チーム名の横の数字は当サイト収録の出場回数です。個別ページは出場{threshold}回以上のチームに作成しています。
          </p>
        </section>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const prefectures = getPrefectures();
  const teams = prefectures.reduce((n, p) => n + p.teamCount, 0);
  return {
    props: {
      prefectures,
      threshold: getThreshold(),
      teamTotal: teams,
      pathwayTotal: countPathways(),
      pathwayTeams: countTeamsWithPathways(),
    },
  };
};
