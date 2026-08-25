// src/pages/teams/[teamId]/index.tsx

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { countTeamMatches, shouldIndexTeamPage } from '@/lib/teamIndexing';
import { aggregateStLeagueTeam, getAllStLeagueTeamIds, StLeagueTeamSummary } from '@/utils/st-league';
// 型のみ（値の import は getStaticProps 内の動的 import に留め、クライアントバンドルに入れない）
import type { EventResult, Player, YearGenderRoster } from '@/utils/team-data-aggregator';

type TeamInfo = {
  id: string;
  name: string;
};

type TeamYearlyStats = {
  year: number;
  stats: {
    gender: 'boys' | 'girls';
    count: number;
  }[];
};

type Props = {
  info: TeamInfo;
  stats: TeamYearlyStats[];
  // tournament の年度別ページ（/teams/[id]/[year]/[gender]）が生成される対象か。
  // 対象外（STリーグのみ等）のチームでは該当リンクを描画しない（404 回避）。
  hasSubPages: boolean;
  stLeague: StLeagueTeamSummary | null;
  // 年度×性別のメンバー一覧（STリーグ登録メンバー ∪ 大会成績から確認できた選手）。
  // docs/raw/2026-08-11-teams-tournament-roster-design.md
  roster: YearGenderRoster[];
  // メンバー名 → 選手結果ページ id（姓名一致、count>=5 のみ。同姓同名は先勝ち）。
  // キーは `${lastName}::${firstName}`。参加者側の id はローカル連番で選手DBの id とは
  // 別物のため使わず、高校学校ページと同じ姓名照合で解決する（docs/wiki/st-league.md）。
  playerLinks: Record<string, number>;
  // SEO: 収録試合が薄いチームページは noindex にする（インデックス枠の集中）。
  // 判定は getStaticProps 側（lib/teamIndexing.ts）。docs/wiki/seo.md #12。
  noindex?: boolean;
};

const GENDER_LABEL: Record<'boys' | 'girls', string> = {
  boys: '男子',
  girls: '女子',
};

export default function TeamResultsPage({ info, stats, hasSubPages, stLeague, roster, playerLinks, noindex = false }: Props) {
  const teamName = info.name;
  const pageUrl = `https://softeni-pick.com/teams/${info.id}/`;

  const hasStLeague = !!stLeague && stLeague.seasons.length > 0;
  // 年度別メンバー節を出すか（STリーグ出場の有無とは独立な軸）。
  const hasRoster = roster.length > 0;
  const latestRoster = roster[0] ?? null;
  // メンバー節の男女タブ。roster は年度降順→男子→女子の順なので先頭の性別を初期表示にする。
  const rosterGenders = (['boys', 'girls'] as const).filter((g) => roster.some((c) => c.gender === g));
  const [rosterGender, setRosterGender] = useState<'boys' | 'girls'>(latestRoster?.gender ?? 'boys');
  const activeRosterGender = rosterGenders.includes(rosterGender) ? rosterGender : (rosterGenders[0] ?? 'boys');

  // title は hasStLeague × hasRoster の4パターン
  // （docs/raw/2026-08-11-teams-tournament-roster-design.md の表）。
  const title = hasStLeague
    ? `${teamName}｜STリーグ出場成績${hasRoster ? '・メンバー' : '・順位'} | ソフトテニス情報`
    : hasRoster
      ? `${teamName} 成績・メンバー | ソフトテニス情報`
      : `${teamName} 所属別成績 | ソフトテニス情報`;
  const description = hasStLeague
    ? `${teamName}のSTリーグ（ソフトテニス実業団リーグ）出場成績。年度別の所属リーグ・対戦成績・順位${
        stLeague!.titlesTop > 0 ? `・優勝${stLeague!.titlesTop}回` : ''
      }${hasRoster ? '・年度別メンバー' : ''}をまとめています。`
    : hasRoster
      ? `${teamName}の大会別成績と年度別メンバー。大会成績から確認できた選手を年度・男女別にまとめています。`
      : `${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`;

  // メンバーFAQは出典（STリーグ/大会成績）を問わない中立な文言にし、hasRoster で出し分ける。
  // STリーグの成績表に関するFAQは従来どおり hasStLeague 判定。
  const faqItems = [
    ...(hasRoster
      ? [
          {
            question: `${teamName}のメンバーは確認できますか？`,
            answer: `${teamName}の年度別メンバーを掲載しています。大会成績・STリーグ出場記録から確認できた選手を年度・男女別にまとめています（最新は${latestRoster!.year}年度${GENDER_LABEL[latestRoster!.gender]}）。個人の試合結果ページがある選手は選手名から移動できます。`,
          },
        ]
      : []),
    ...(hasStLeague
      ? [
          {
            question: `${teamName}のSTリーグでの成績は何が分かりますか？`,
            answer: `${teamName}の年度別の所属部・対戦成績・順位を確認できます。各年度のリンクから対戦表や個別カードの結果も見られます。`,
          },
        ]
      : []),
  ];

  return (
    <>
      <MetaHead title={title} description={description} url={pageUrl} noindex={noindex} noindexFollow={noindex} />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: title.split(' | ')[0],
              author: { '@type': 'Organization', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description,
              about: {
                '@type': 'SportsTeam',
                name: teamName,
                url: pageUrl,
              },
            }),
          }}
        />

        {faqItems.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faqItems.map((item) => ({
                  '@type': 'Question',
                  name: item.question,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                  },
                })),
              }),
            }}
          />
        )}
      </Head>

      <PageLayout className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: teamName, href: `/teams/${info.id}` },
          ]}
        />

        <h1 className="text-2xl font-bold">{teamName} | 成績</h1>

        <section className="text-sm text-text-secondary leading-relaxed">
          <p className="mb-2">
            {teamName}
            のソフトテニスにおける成績をまとめたページです。
            {hasStLeague && 'STリーグ（実業団リーグ）の年度別成績・順位、'}
            大会ごとの記録などを確認できます。
          </p>
        </section>

        {/* STリーグでの成績 */}
        {hasStLeague && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-bold">STリーグでの成績</h2>
              <Link href="/st-league" className="text-sm text-link font-semibold hover:underline">
                STリーグ トップ →
              </Link>
            </div>

            <p className="text-sm text-text-muted mb-3">
              出場: {stLeague!.firstYear}〜{stLeague!.lastYear}
              {stLeague!.titlesTop > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-warning font-semibold">Ⅰ部優勝 {stLeague!.titlesTop}回</span>
              )}
            </p>

            <div className="bg-surface rounded-xl shadow-sm overflow-hidden border border-border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-medium">年度</th>
                    <th className="py-2.5 px-2 text-left font-medium">区分</th>
                    <th className="py-2.5 px-2 text-center font-medium">成績</th>
                    <th className="py-2.5 px-3 text-center font-medium">順位</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stLeague!.seasons.map((s) => (
                    <tr key={`${s.year}-${s.gender}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        <Link href={`/st-league/${s.year}/matches`} className="hover:text-blue-600 hover:underline">
                          {s.year}
                          {s.edition ? `（第${s.edition}回）` : ''}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-text-secondary whitespace-nowrap">
                        {GENDER_LABEL[s.gender]}・{s.divisionName}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {s.played > 0 ? (
                          <span className="font-mono">
                            <span className="font-bold">{s.won}</span>
                            <span className="text-gray-400">-</span>
                            <span className="text-gray-500">{s.lost}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {s.isChampion ? (
                          <span className="inline-flex items-center gap-1 text-warning font-bold">優勝</span>
                        ) : s.rank ? (
                          `${s.rank}位`
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">各年度の対戦結果・順位表は年度リンクから確認できます。</p>
          </section>
        )}

        {/* 年度別メンバー（STリーグ登録メンバー ∪ 大会成績から確認できた選手） */}
        {hasRoster && (
          <section>
            <h2 className="text-xl font-bold mb-3">{teamName}の年度別メンバー</h2>
            <p className="text-sm text-text-secondary mb-4">
              大会成績・STリーグ出場記録から確認できた選手を年度・男女別にまとめています。個人の試合結果ページがある選手は選手名から移動できます。
            </p>

            {/* 男女タブ（両方ある場合のみ）。/st-league/[year]/teams と同じ見た目に揃える。 */}
            {rosterGenders.length > 1 && (
              <div className="flex border-b border-border mb-4">
                {rosterGenders.map((g) => {
                  const active = g === activeRosterGender;
                  const activeClass =
                    g === 'boys'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400';
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRosterGender(g)}
                      aria-pressed={active}
                      className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                        active ? activeClass : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      {GENDER_LABEL[g]}
                    </button>
                  );
                })}
              </div>
            )}

            {/* SEO: 男女どちらのパネルもHTMLに出力し、非アクティブは hidden で隠す
                （docs/wiki/st-league.md「全 gender×division のパネルを最初から出力」と同方針）。 */}
            {rosterGenders.map((g) => {
              const active = g === activeRosterGender;
              return (
                <div key={g} className={active ? 'space-y-4' : 'hidden'} aria-hidden={!active}>
                  {roster
                    .filter((cell) => cell.gender === g)
                    .map(({ year, gender, members }) => (
                      <div key={`${year}-${gender}`} className="rounded-xl border border-border p-4">
                        {/* 性別はタブが示すのでカード内には出さない。タブが無い（片方の性別のみ）
                            チームでは情報が失われるのでその場合だけ併記する。 */}
                        <h3 className="font-semibold mb-2">
                          {year}年度{rosterGenders.length > 1 ? '' : ` ${GENDER_LABEL[gender]}`} ・ {members.length}名
                        </h3>
                        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
                          {members.map((p, idx) => {
                            const linkId = playerLinks[`${p.lastName}::${p.firstName}`];
                            return (
                              <li key={`${p.lastName}-${p.firstName}-${idx}`}>
                                {linkId ? (
                                  <Link href={`/players/${linkId}/results`} className="text-link hover:underline">
                                    {p.lastName} {p.firstName}
                                  </Link>
                                ) : (
                                  `${p.lastName} ${p.firstName}`
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                </div>
              );
            })}
          </section>
        )}

        {/* 大会別成績（tournament の年度別ページがある対象のみ） */}
        {hasSubPages && stats.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">大会別成績</h2>
            {stats.map(({ year, stats: yearStats }) => (
              <div key={year} className="mb-10">
                <h3 className="text-lg font-bold mb-4 border-b-2 border-border pb-2">{year}年度</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {yearStats.map(({ gender, count }) => (
                    <Link
                      key={gender}
                      href={`/teams/${info.id}/${year}/${gender}`}
                      className="block bg-surface rounded-xl shadow p-6 border border-border hover:shadow-md transition-shadow"
                    >
                      <h4 className="text-lg font-bold mb-2 text-text">{GENDER_LABEL[gender]}</h4>
                      <p className="text-sm text-text-muted">大会数: {count}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {faqItems.length > 0 && (
          <section className="mt-4 border-t border-border pt-8">
            <h2 className="text-xl font-semibold mb-4">よくある質問</h2>
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-xl border border-border p-4">
                  <h3 className="font-semibold mb-2">{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const fs = await import('fs');
  const path = await import('path');

  const mappingsPath = path.join(process.cwd(), 'data/teams/team-name-mappings.json');

  const ids = new Set<string>();
  if (fs.existsSync(mappingsPath)) {
    const teamNameMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8')) as Record<string, string[]>;
    Object.keys(teamNameMappings).forEach((id) => ids.add(id));
  }
  // STリーグ出場チームにもページを生成する（チーム名リンクの受け皿）
  getAllStLeagueTeamIds().forEach((id) => ids.add(id));

  return {
    paths: Array.from(ids).map((teamId) => ({ params: { teamId } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const fs = await import('fs');
  const path = await import('path');
  const { aggregateTeamResults, buildTeamRosterByYearGender, generateTeamInfo, gendersWithRealPresence } = await import('@/utils/team-data-aggregator');
  const { teamId } = context.params as { teamId: string };

  // tournament の年度別下層ページが生成される対象か（mapping キーのみ）。
  const mappingsPath = path.join(process.cwd(), 'data/teams/team-name-mappings.json');
  let hasSubPages = false;
  if (fs.existsSync(mappingsPath)) {
    const keys = Object.keys(JSON.parse(fs.readFileSync(mappingsPath, 'utf-8')) as Record<string, string[]>);
    hasSubPages = keys.includes(teamId);
  }

  const stLeague = aggregateStLeagueTeam(teamId);

  let name = teamId;
  let stats: TeamYearlyStats[] = [];
  // SEO: noindex 判定に使う収録試合数（大会 ＋ STリーグ の合算）。
  let matchCount = (stLeague?.seasons ?? []).reduce((sum, season) => sum + season.played, 0);

  // 年度別メンバー節の材料。hasSubPages でないチームでは空のまま（STリーグ側だけで構築する）。
  let teamPlayers: Record<string, Player> = {};
  let allResults: EventResult[] = [];

  // tournament データ（下層ページ対象チームのみ集計してリンクを出す）
  if (hasSubPages) {
    try {
      const fullInfo = generateTeamInfo(teamId);
      if (fullInfo.name) name = fullInfo.name;
      if (fullInfo.players && Object.keys(fullInfo.players).length > 0) {
        teamPlayers = fullInfo.players;
        allResults = aggregateTeamResults(teamId);
        matchCount += countTeamMatches(allResults, new Set(Object.keys(fullInfo.players)));
        // 混合ダブルスしか無い性別（実体の無い性別）は表示しない。
        const realGenders = gendersWithRealPresence(allResults);
        const statsMap = new Map<number, Map<'boys' | 'girls', number>>();
        for (const result of allResults) {
          const { year, gender } = result;
          if (gender !== 'boys' && gender !== 'girls') continue;
          if (!realGenders.has(gender)) continue;
          if (!statsMap.has(year)) statsMap.set(year, new Map());
          const yearStats = statsMap.get(year)!;
          yearStats.set(gender, (yearStats.get(gender) || 0) + 1);
        }
        stats = Array.from(statsMap.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, genderCounts]) => ({
            year,
            stats: Array.from(genderCounts.entries())
              .map(([gender, count]) => ({ gender, count }))
              .sort((a, b) => a.gender.localeCompare(b.gender)),
          }));
      }
    } catch (error) {
      console.error(`Error generating tournament data for ${teamId}:`, error);
    }
  }

  // 表示名: STリーグ名を優先（mapping チームは tournament 名を使う）
  if (stLeague && (!hasSubPages || name === teamId)) {
    name = stLeague.name;
  }

  // STリーグ・大会いずれのデータも無ければ 404
  if (!stLeague && stats.length === 0) {
    return { notFound: true };
  }

  // メンバー名 → 選手結果ページ id（姓名一致、count>=5 のみ）。
  // participants.json 側の id はローカル連番で選手DBの id とは別物なので使わない
  // （docs/wiki/st-league.md、高校学校ページと同じ姓名照合パターン）。
  //
  // 解決対象は STリーグ側（stLeague.seasons[].players）と大会成績側（generateTeamInfo の
  // players）の**和集合**。STリーグ非出場チーム（nssu 等）でも大会成績側の氏名を
  // リンクできるよう、`if (stLeague)` のガードは掛けない。
  const playerLinks: Record<string, number> = {};
  {
    const playersIndexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
    if (fs.existsSync(playersIndexPath)) {
      try {
        const playersIndex = JSON.parse(fs.readFileSync(playersIndexPath, 'utf-8')) as Array<{
          id: number;
          lastName: string;
          firstName: string;
          count: number;
        }>;
        const nameToId = new Map<string, number>();
        for (const p of playersIndex) {
          if (p.count < 5) continue;
          const key = `${p.lastName}::${p.firstName}`;
          // 同姓同名は最初の ID を使う（players/index.tsx と同じ規約）
          if (!nameToId.has(key)) nameToId.set(key, p.id);
        }
        const candidates: Array<{ lastName: string; firstName: string }> = [
          ...(stLeague?.seasons ?? []).flatMap((season) => season.players),
          ...Object.values(teamPlayers),
        ];
        for (const player of candidates) {
          const key = `${player.lastName}::${player.firstName}`;
          if (playerLinks[key] !== undefined) continue;
          const id = nameToId.get(key);
          if (id !== undefined) playerLinks[key] = id;
        }
      } catch (err) {
        console.error('failed to parse players index.json', err);
      }
    }
  }

  // 年度×性別メンバー（STリーグ ∪ 大会成績。氏名の正規化で dedup）。
  const roster = buildTeamRosterByYearGender({
    results: allResults,
    teamPlayers,
    stLeagueSeasons: (stLeague?.seasons ?? []).map((season) => ({
      year: season.year,
      gender: season.gender,
      players: season.players,
    })),
    isLinkable: (member) => playerLinks[`${member.lastName}::${member.firstName}`] !== undefined,
  });

  // --- SEO: 薄いチームページの noindex 判定 ---
  // 大会 + STリーグ の収録試合が TEAM_INDEX_MIN_MATCHES 未満なら noindex, follow。
  // follow なので年度別ページ・選手ページ・STリーグ側への内部リンクは評価を流す。
  // sitemap からの除外は postbuild（scripts/filter-noindex-from-sitemap.mjs）が自動追従する。
  return {
    props: {
      info: { id: teamId, name },
      stats,
      hasSubPages,
      stLeague,
      roster,
      playerLinks,
      noindex: !shouldIndexTeamPage(matchCount),
    },
  };
};
