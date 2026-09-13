// src/pages/primaryschool/[prefectureId]/[teamId].tsx
// 小学生カテゴリの団体ページ。**男女を1ページにまとめる**（URLに性別を入れない）。
//
// 閾値5の298団体のうち263（88%）が男女両方に出ているので、男女別URLにすると
// 561ページになるが中身は半分ずつに割れる。中学（1枚にまとめた理由は薄さ）より
// 強い理由がある。docs/wiki/primaryschool.md
//
// このページの差別化は「進路」節。小学・中学・高校を名寄せ済みで持っているサイトにしか作れない。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  describeResult,
  getAllTeams,
  getPathways,
  getTeam,
  resolvePlayerId,
  resolveSecondarySchoolHref,
  type PrimaryPathwayRecord,
  type PrimarySchoolTeam,
} from '@/lib/primaryschool';

/** 選手名にリンクを付けるための解決済みデータ（props はシリアライズ可能である必要がある） */
type NamedLink = { name: string; playerId: number | null };

interface Props {
  team: PrimarySchoolTeam;
  /** `secondaryschoolHref` は中学チームページが実在するときだけ入る（デッドリンク防止） */
  pathways: (PrimaryPathwayRecord & { playerId: number | null; secondaryschoolHref: string | null })[];
  members: (NamedLink & { years: number[] })[];
  resultPlayers: Record<string, NamedLink[]>;
}

function PlayerNames({ players }: { players: NamedLink[] }) {
  if (players.length === 0) return null;
  return (
    <>
      {players.map((p, i) => (
        <span key={`${p.name}-${i}`}>
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
    </>
  );
}

export default function PrimarySchoolTeamPage({ team, pathways, members, resultPlayers }: Props) {
  const pageUrl = `https://softeni-pick.com/primaryschool/${team.prefectureId}/${team.id}/`;
  const yearRange = team.years.length
    ? team.years[0] === team.years[team.years.length - 1]
      ? `${team.years[0]}年`
      : `${team.years[0]}〜${team.years[team.years.length - 1]}年`
    : '';

  // 年度ごとに成績をまとめる（新しい年が先頭）
  const byYear = [...new Set(team.results.map((r) => r.year))].sort((a, b) => b - a);

  return (
    <>
      <MetaHead
        title={`${team.name}（${team.prefecture}）小学生ソフトテニスの成績 | Softeni Pick`}
        description={`${team.prefecture}の${team.name}の小学生ソフトテニス戦績。${yearRange}の全日本小学生選手権大会の結果${team.results.length}件${team.best ? `（最高成績: ${describeResult(team.best)}）` : ''}${pathways.length > 0 ? `と、卒業後の進学先${pathways.length}件` : ''}をまとめています。`}
        url={pageUrl}
        type="website"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsTeam',
              name: team.name,
              sport: 'ソフトテニス',
              url: pageUrl,
              address: { '@type': 'PostalAddress', addressRegion: team.prefecture, addressCountry: 'JP' },
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '小学生', href: '/primaryschool' },
            { label: team.prefecture, href: `/primaryschool/${team.prefectureId}` },
            { label: team.name, href: `/primaryschool/${team.prefectureId}/${team.id}` },
          ]}
        />

        <h1 className="text-2xl font-bold mb-1">{team.name}</h1>
        <p className="mb-6 text-sm text-text-muted">
          {team.prefecture}
          {yearRange && ` ／ 収録 ${yearRange}`}
        </p>

        {team.best && (
          <section className="mb-8 rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-1 text-base font-semibold">当サイト収録の最高成績</h2>
            <p className="text-lg font-bold text-text">{describeResult(team.best)}</p>
            {team.best.players.length > 0 && (
              <p className="mt-1 text-sm text-text-secondary">
                <PlayerNames
                  players={
                    resultPlayers[`${team.best.tournamentId}-${team.best.year}-${team.best.categoryId}-${team.best.label ?? ''}`] ??
                    team.best.players.map((n) => ({ name: n, playerId: null }))
                  }
                />
              </p>
            )}
          </section>
        )}

        {pathways.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-bold">この団体から中学への進路</h2>
            <p className="mb-3 text-sm text-text-secondary">
              {team.name}
              で全日本小学生選手権大会に出場したあと、中学の全国大会（全国中学校大会・都道府県対抗全日本中学生大会・各地区のブロック大会）に出場した選手です。
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {pathways.map((p) => (
                <li key={`${p.player}-${p.secondaryschool}`} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <span className="font-semibold">
                    {p.playerId ? (
                      <Link href={`/players/${p.playerId}/results`} className="text-link hover:underline">
                        {p.player}
                      </Link>
                    ) : (
                      p.player
                    )}
                  </span>
                  <span className="mx-2 text-text-muted">→</span>
                  {p.secondaryschoolHref ? (
                    <Link href={p.secondaryschoolHref} className="font-semibold text-link hover:underline">
                      {p.secondaryschool}
                    </Link>
                  ) : (
                    <span className="font-semibold">{p.secondaryschool}</span>
                  )}
                  <p className="mt-0.5 text-xs text-text-muted">
                    小学生 {p.primaryLastYear}年 ／ 中学 {p.secondaryschoolFirstYear}年〜
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              氏名の一致で追跡しています。小学生の大会で最後に出場した年から6年以内に中学の全国大会へ出場した同姓同名の選手を
              同一人物とみなしているため、同姓同名の別人が含まれている可能性があります。進学しても収録大会に出場していない選手は表示されません。
            </p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">大会成績（{team.results.length}件）</h2>
          {byYear.map((year) => (
            <div key={year} className="mb-4">
              <h3 className="mb-1 text-base font-semibold">{year}年度</h3>
              <ul className="space-y-1 text-sm">
                {team.results
                  .filter((r) => r.year === year)
                  .map((r, i) => {
                    const key = `${r.tournamentId}-${r.year}-${r.categoryId}-${r.label ?? ''}`;
                    return (
                      <li key={`${key}-${i}`} className="rounded border border-border bg-surface px-3 py-2">
                        <span className="text-text-secondary">{r.tournamentLabel}</span>
                        <span className="mx-2">{describeResult(r)}</span>
                        {r.players.length > 0 && (
                          <span className="text-text-muted">
                            <PlayerNames players={resultPlayers[key] ?? r.players.map((n) => ({ name: n, playerId: null }))} />
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          {team.results.length === 0 && (
            <p className="text-sm text-text-muted">収録している成績がありません。全日本小学生選手権大会の結果に名前が載ると、ここに年度別の成績が並びます。</p>
          )}
        </section>

        {members.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-bold">収録大会に出場した選手（{members.length}名）</h2>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {members.map((m) => (
                <li key={m.name}>
                  {m.playerId ? (
                    <Link href={`/players/${m.playerId}/results`} className="text-link hover:underline">
                      {m.name}
                    </Link>
                  ) : (
                    m.name
                  )}
                  <span className="ml-1 text-xs text-text-muted">{m.years.join('・')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-muted">当サイトが収録した大会結果に名前が載った選手のみです。名簿ではありません。</p>
          </section>
        )}

        <p className="text-sm">
          <Link href={`/primaryschool/${team.prefectureId}/`} className="text-link hover:underline">
            {team.prefecture}の他の団体を見る
          </Link>
        </p>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getAllTeams().map((t) => ({ params: { prefectureId: t.prefectureId, teamId: t.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const { prefectureId, teamId } = context.params as { prefectureId: string; teamId: string };
  const team = getTeam(prefectureId, teamId);
  if (!team) return { notFound: true };

  // 選手名 → 選手ページID の解決はビルド時にまとめて行う（クライアントに index.json を送らない）
  const resultPlayers: Record<string, NamedLink[]> = {};
  for (const r of team.results) {
    const key = `${r.tournamentId}-${r.year}-${r.categoryId}-${r.label ?? ''}`;
    if (!resultPlayers[key]) resultPlayers[key] = r.players.map((n) => ({ name: n, playerId: resolvePlayerId(n) }));
  }

  return {
    props: {
      team,
      pathways: getPathways(team).map((p) => ({
        ...p,
        playerId: resolvePlayerId(p.player),
        secondaryschoolHref: resolveSecondarySchoolHref(p.secondaryschool, p.secondaryschoolPrefecture),
      })),
      members: team.members.map((m) => ({ name: m.name, years: m.years, playerId: resolvePlayerId(m.name) })),
      resultPlayers,
    },
  };
};
