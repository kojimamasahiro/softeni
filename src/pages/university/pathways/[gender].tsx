// src/pages/university/pathways/[gender].tsx
// 大学別の「出身高校」一覧（/university/pathways/boys/ ・ /girls/）。
//
// **大学起点**にしている（中学版 /secondaryschool/pathways/ は高校起点）。
// 大学の個別ページ（/teams/[teamId]）は収録の多い38校にしか無く（2026-09-14）、
// それ以外の大学はこの一覧が「{大学名} ソフトテニス部」の受け皿になるため。
// 高校起点の見え方は高校の学校ページの「進路」節（lib/university.ts getUniversityDestinations）が担当する。
//
// **男女で別URL**にしているのは中学版と同じ理由（高校の学校ページが男女別で、そこから同じ性別へ送る）。
// 大学ごとの見出しにアンカー（universityAnchor）を付け、高校の学校ページからはそこへ直接飛ばす。
//
// リンク先はすべて実在確認してから出す（デッドリンク防止）。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import HighschoolGenderToggle from '@/components/highschool/HighschoolGenderToggle';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getSchoolResolver } from '@/lib/highschoolNationalTournaments';
import { resolvePlayerId } from '@/lib/secondaryschool';
import { getMaxYearGap, getUniversityGroups, getUniversityTeamHref, universityAnchor, type UniversityGender } from '@/lib/university';

const GENDERS = ['boys', 'girls'] as const;

interface Group {
  university: string;
  anchor: string;
  teamHref: string | null;
  playerCount: number;
  highschools: {
    highschool: string;
    prefecture: string | null;
    highschoolHref: string | null;
    players: { name: string; playerId: number | null; highschoolLastYear: number; universityFirstYear: number }[];
  }[];
}

interface Props {
  gender: UniversityGender;
  groups: Group[];
  total: number;
  maxYearGap: number;
}

export default function UniversityPathways({ gender, groups, total, maxYearGap }: Props) {
  const pageUrl = `https://softeni-pick.com/university/pathways/${gender}/`;
  const genderLabel = gender === 'boys' ? '男子' : '女子';

  return (
    <>
      <MetaHead
        title={`大学${genderLabel}の出身高校一覧 | 大学ソフトテニス | Softeni Pick`}
        description={`全日本学生選手権（インカレ）などに出場している大学ソフトテニス部（${genderLabel}）の選手が、どの高校の出身かを大学別にまとめた一覧です。${groups.length}校・${total}名を掲載。高校で最後に出場した年から${maxYearGap}年以内に大学の全国大会へ出場した同姓同名の選手を同一人物として追跡しています。`}
        url={pageUrl}
        type="website"
      />

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大学生', href: '/university' },
            { label: `大学${genderLabel}の出身高校`, href: `/university/pathways/${gender}` },
          ]}
        />

        <h1 className="mb-2 text-2xl font-bold">大学{genderLabel}の出身高校</h1>
        <p className="mb-6 text-sm text-text-secondary">
          大学の全国大会（全日本学生選手権・全日本大学王座決定戦・全日本学生選抜インドア）に出場した{genderLabel}選手が、
          高校時代にどの学校で全国大会に出ていたかを大学別にまとめています。
          <strong className="font-semibold">
            {groups.length}校・{total}名
          </strong>
          を掲載しています。出身高校の多い大学を先に並べています。
        </p>

        <HighschoolGenderToggle gender={gender} boysHref="/university/pathways/boys" girlsHref="/university/pathways/girls" className="mb-8 max-w-sm mx-auto" />

        <div className="mb-8 rounded-lg border border-border bg-bg-subtle p-4 text-xs text-text-muted">
          <p className="mb-1 font-semibold text-text-secondary">掲載の条件</p>
          <p>
            <strong className="font-semibold">氏名の一致</strong>で追跡しています。高校で最後に出場した年から
            <strong className="font-semibold">{maxYearGap}年以内</strong>に大学の全国大会に出場した同姓同名の選手を同一人物とみなしています
            （高校3年で最後に出場して大学4年で初出場する場合が最長）。
            別チームに同姓同名がいることが確認できた氏名と、高校と大学で性別が違う一致は除外していますが、
            <strong className="font-semibold">同姓同名の別人が含まれている可能性は残ります</strong>。 また
            <strong className="font-semibold">ここに出ていない選手も多くいます</strong>（高校時代に全国大会へ出ていない、など）。
            大学ごとの人数は部員数ではなく、当サイトが追跡できた人数です。
          </p>
        </div>

        <nav aria-label="大学一覧" className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">大学から探す</h2>
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li key={g.anchor}>
                <a href={`#${g.anchor}`} className="inline-block rounded-full bg-info-bg px-3 py-1 text-sm text-info transition hover:opacity-80">
                  {g.university}
                  <span className="ml-1 text-xs text-text-muted">{g.playerCount}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {groups.map((g) => (
          <section key={g.anchor} id={g.anchor} className="mb-6 scroll-mt-20">
            <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base font-bold">
              {g.teamHref ? (
                <Link href={g.teamHref} className="text-link hover:underline">
                  {g.university}
                </Link>
              ) : (
                <span>{g.university}</span>
              )}
              <span className="text-xs font-normal text-text-muted">
                出身高校{g.highschools.length}校・{g.playerCount}名
              </span>
            </h2>
            <ul className="grid gap-2">
              {g.highschools.map((h) => (
                <li key={`${h.highschool}\t${h.prefecture ?? ''}`} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {h.highschoolHref ? (
                      <Link href={h.highschoolHref} className="font-semibold text-link hover:underline">
                        {h.highschool}
                      </Link>
                    ) : (
                      <span className="font-semibold">{h.highschool}</span>
                    )}
                    {h.prefecture && <span className="text-xs text-text-muted">{h.prefecture}</span>}
                  </div>
                  <p className="mt-1">
                    {h.players.map((p, i) => (
                      <span key={p.name}>
                        {i > 0 && '・'}
                        {p.playerId ? (
                          <Link href={`/players/${p.playerId}/results`} className="text-link hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </span>
                    ))}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    高校 {Math.min(...h.players.map((p) => p.highschoolLastYear))}年 ／ 大学 {Math.min(...h.players.map((p) => p.universityFirstYear))}年〜
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-8 text-sm">
          <Link href="/university/" className="text-link hover:underline">
            大学ソフトテニスのトップへ
          </Link>
        </p>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: GENDERS.map((gender) => ({ params: { gender } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const gender = (context.params as { gender: string }).gender as UniversityGender;
  if (!GENDERS.includes(gender)) return { notFound: true };

  const schoolResolver = getSchoolResolver();
  const groups: Group[] = getUniversityGroups(gender).map((g) => ({
    university: g.university,
    anchor: universityAnchor(g.university),
    teamHref: getUniversityTeamHref(g.university),
    playerCount: g.playerCount,
    highschools: g.highschools.map((h) => ({
      highschool: h.highschool,
      prefecture: h.prefecture,
      highschoolHref: schoolResolver(h.highschool, h.prefecture, gender),
      players: h.players.map((p) => ({ ...p, playerId: resolvePlayerId(p.name) })),
    })),
  }));

  return {
    props: {
      gender,
      groups,
      total: groups.reduce((n, g) => n + g.playerCount, 0),
      maxYearGap: getMaxYearGap(),
    },
  };
};
