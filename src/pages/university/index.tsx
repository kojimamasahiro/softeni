// src/pages/university/index.tsx
// 大学カテゴリの入口（2026-09-13 追加）。
//
// 小中高と構成が違う。大学は participants[].prefecture が `日本学連`/`学連` で**地域軸が無い**ため、
// 都道府県ページもチームページも作らず、「高校 → 大学」の進路から大学を探す構成にしている。
// 大会軸のページも作らない。インカレ・王座・インドアは既存の大会ハブに寄せる（ADR-010）。
// ランキング・順位づけもしない（中学カテゴリの判断に合わせる）。
// 経緯: docs/wiki/university.md

import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  getUniversityGroups,
  getUniversityStats,
  universityPathwaysHref,
  type UniversityStats,
  type UniversityTournamentLink,
  getUniversityTeamHref,
  getUniversityTournaments,
} from '@/lib/university';

interface UniversityChip {
  university: string;
  boys: number;
  girls: number;
  /** /teams/[teamId] の成績ページ（team-name-mappings.json にある大学のみ） */
  teamHref: string | null;
}

interface Props {
  stats: UniversityStats;
  tournaments: UniversityTournamentLink[];
  universities: UniversityChip[];
}

export default function UniversityIndex({ stats, tournaments, universities }: Props) {
  const pageUrl = 'https://softeni-pick.com/university/';

  return (
    <>
      <MetaHead
        title="大学ソフトテニス | インカレ・王座の結果と出身高校 | Softeni Pick"
        description={`大学ソフトテニスの特集ページ。全日本学生選手権（インカレ）・全日本大学王座決定戦・全日本学生選抜インドアの結果と、大学別の出身高校をまとめています。${stats.universities}校・${stats.records}名の高校から大学への進路を掲載。`}
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大学生', href: '/university' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">大学ソフトテニス</h1>
        <p className="mb-6 text-sm text-text-secondary">
          大学の全国大会の結果と、高校から大学への進路をまとめています。
          大学のチームは都道府県ではなく学生連盟に所属しているため、このカテゴリでは都道府県別のページを持たず、
          <strong className="font-semibold">大学ごとの出身高校</strong>から探せるようにしています。
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">大学別の出身高校</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/university/pathways/boys/"
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle"
            >
              <h3 className="text-base font-semibold text-text">男子</h3>
              <p className="text-xs text-text-muted">
                {stats.boys.universities}校・{stats.boys.records}名
              </p>
            </Link>
            <Link
              href="/university/pathways/girls/"
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-bg-subtle"
            >
              <h3 className="text-base font-semibold text-text">女子</h3>
              <p className="text-xs text-text-muted">
                {stats.girls.universities}校・{stats.girls.records}名
              </p>
            </Link>
          </div>
          {stats.fromSecondarySchool > 0 && (
            <p className="text-xs text-text-muted">
              このうち{stats.fromSecondarySchool}名は、中学の全国大会から高校・大学まで続けて追跡できた選手です。 中学から高校への進路は
              <Link href="/secondaryschool/" className="text-link hover:underline">
                中学生のページ
              </Link>
              にあります。
            </p>
          )}
        </section>

        {tournaments.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">大会の結果</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {tournaments.map((t) => (
                <Link
                  key={t.tournamentId}
                  href={t.href}
                  className="rounded-lg border border-border bg-surface p-4 text-sm font-semibold transition-colors hover:bg-bg-subtle"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold">大学から探す</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {universities.map((u) => (
              <li key={u.university} className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                {u.teamHref ? (
                  <Link href={u.teamHref} className="font-semibold text-link hover:underline">
                    {u.university}
                  </Link>
                ) : (
                  <span className="font-semibold">{u.university}</span>
                )}
                {u.boys > 0 && (
                  <Link href={universityPathwaysHref(u.university, 'boys')} className="text-link hover:underline">
                    男子 {u.boys}名
                  </Link>
                )}
                {u.girls > 0 && (
                  <Link href={universityPathwaysHref(u.university, 'girls')} className="text-link hover:underline">
                    女子 {u.girls}名
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted">
            大学名のリンクは、年度別メンバーと大会別成績をまとめた大学のページです（収録の多い大学のみ）。
            人数は部員数ではなく、高校の全国大会の出場記録から当サイトが追跡できた選手の数です。同姓同名の別人が含まれている可能性があります。
          </p>
        </section>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const chips = new Map<string, UniversityChip>();
  for (const g of ['boys', 'girls'] as const) {
    for (const group of getUniversityGroups(g)) {
      const chip = chips.get(group.university) ?? { university: group.university, boys: 0, girls: 0, teamHref: getUniversityTeamHref(group.university) };
      chip[g] = group.playerCount;
      chips.set(group.university, chip);
    }
  }
  return {
    props: {
      stats: getUniversityStats(),
      tournaments: getUniversityTournaments(),
      // 男女合計の人数が多い順（同数は名前順）
      universities: [...chips.values()].sort((a, b) => b.boys + b.girls - (a.boys + a.girls) || a.university.localeCompare(b.university, 'ja')),
    },
  };
};
