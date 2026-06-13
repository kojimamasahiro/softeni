import Head from 'next/head';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  buildPlayerMap,
  computeRanking,
  divisionOf,
  DivisionMeta,
  Gender,
  getDivisions,
  getStLeagueYears,
  LeagueMeta,
  loadLeagueMeta,
  loadMatches,
  loadParticipants,
  Match,
  PlayerMap,
  Team,
} from '@/utils/st-league';

interface MatchesPageProps {
  year: number;
  meta: LeagueMeta | null;
  divisions: DivisionMeta[];
  matches: { boys: Match[]; girls: Match[] };
  teams: { boys: Team[]; girls: Team[] };
  playerMaps: { boys: PlayerMap; girls: PlayerMap };
}

const DIV_BADGE =
  'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold';

export default function MatchesPage({
  year,
  meta,
  divisions,
  matches,
  teams,
  playerMaps,
}: MatchesPageProps) {
  const [gender, setGender] = useState<Gender>('boys');
  const [divisionId, setDivisionId] = useState<string>(divisions[0]?.id ?? '1');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const teamsInDiv = useMemo(
    () => teams[gender].filter((t) => divisionOf(t) === divisionId),
    [teams, gender, divisionId],
  );
  const matchesInDiv = useMemo(
    () => matches[gender].filter((m) => divisionOf(m) === divisionId),
    [matches, gender, divisionId],
  );
  const playerMap = playerMaps[gender] || {};

  const getTeamName = (teamId: string) =>
    teamsInDiv.find((t) => t.teamId === teamId)?.name[0] ?? teamId;
  const getPlayerNames = (ids?: number[]) =>
    !ids ? '-' : ids.map((id) => playerMap[id] || `ID:${id}`).join('・');

  const ranking = useMemo(
    () => computeRanking(teamsInDiv, matchesInDiv),
    [teamsInDiv, matchesInDiv],
  );

  const currentDiv = divisions.find((d) => d.id === divisionId);
  const isLowest = currentDiv
    ? currentDiv.rank === Math.max(...divisions.map((d) => d.rank))
    : true;
  const isTop = currentDiv ? currentDiv.rank === 1 : true;

  const toggle = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const pageTitle = `${editionLabel} 試合結果・順位表 | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/matches`;
  const dateRange = meta?.period
    ? `${meta.period.start.replace(/-/g, '/')}〜${meta.period.end.replace(/-/g, '/')}`
    : '';

  return (
    <>
      <MetaHead
        title={pageTitle}
        description={`${editionLabel}（${dateRange}${meta?.venue ? ` / ${meta.venue}` : ''}）の男女・STリーグⅠ/Ⅱ/Ⅲ別の試合結果と順位表。`}
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: editionLabel,
              sport: 'ソフトテニス',
              ...(meta?.period && {
                startDate: meta.period.start,
                endDate: meta.period.end,
              }),
              ...(meta?.venue && {
                location: {
                  '@type': 'Place',
                  name: meta.venue,
                  ...(meta.location && { address: meta.location }),
                },
              }),
              organizer: {
                '@type': 'Organization',
                name: '公益財団法人 日本ソフトテニス連盟',
              },
              url: pageUrl,
            }),
          }}
        />
      </Head>
      <PageLayout maxWidth="4xl" className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year} 試合結果`, href: `/st-league/${year}/matches` },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">{editionLabel} 結果・順位表</h1>
          {(dateRange || meta?.venue) && (
            <p className="text-sm text-gray-500 mt-1">
              {dateRange}
              {meta?.venue && `　${meta.venue}`}
              {meta?.location && `（${meta.location}）`}
            </p>
          )}
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            STリーグⅠ・Ⅱ・Ⅲと男女別に、対戦成績・順位表を掲載しています。
          </p>
        </header>

        {/* 性別タブ */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setGender('boys')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              gender === 'boys'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            男子
          </button>
          <button
            onClick={() => setGender('girls')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              gender === 'girls'
                ? 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            女子
          </button>
        </div>

        {/* リーグ（division）切替 */}
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => {
            const active = d.id === divisionId;
            return (
              <button
                key={d.id}
                onClick={() => setDivisionId(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>

        {currentDiv?.note && (
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            {currentDiv.note}
          </p>
        )}

        {teamsInDiv.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
            <p className="font-semibold mb-1">
              {currentDiv?.name ?? 'このリーグ'}のデータは準備中です
            </p>
            <p className="text-xs">公式記録をもとに順次追加していきます。</p>
          </div>
        ) : (
          <>
            {/* 順位表 */}
            <section>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                {currentDiv?.name} 順位表
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                順位は「勝数」→「同勝数内の直接対決」→「得失点差」の順で決定。
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium w-16">
                        順位
                      </th>
                      <th className="py-3 px-2 text-left font-medium">
                        チーム
                      </th>
                      <th className="py-3 px-2 text-center font-medium w-20">
                        勝敗
                      </th>
                      <th className="py-3 px-4 text-center font-medium w-16">
                        得失
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ranking.map((team, index) => {
                      const rank = index + 1;
                      const total = ranking.length;
                      // 入替戦ゾーンの目安（最上位リーグの下位2、最下位以外の上位2）
                      const relegationZone =
                        !isLowest && rank > total - 2 && team.played > 0;
                      const promotionZone =
                        !isTop && rank <= 2 && team.played > 0;
                      return (
                        <tr
                          key={team.teamId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              {rank}
                              {promotionZone && (
                                <span
                                  className={`${DIV_BADGE} bg-green-100 text-green-700`}
                                  title="入替戦（昇格）対象の目安"
                                >
                                  昇
                                </span>
                              )}
                              {relegationZone && (
                                <span
                                  className={`${DIV_BADGE} bg-red-100 text-red-700`}
                                  title="入替戦（降格）対象の目安"
                                >
                                  降
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-medium">{team.name}</td>
                          <td className="py-3 px-2 text-center">
                            {team.played > 0 ? (
                              <span className="inline-flex gap-1">
                                <span className="font-bold">{team.won}</span>
                                <span className="text-gray-400 mx-0.5">-</span>
                                <span className="text-gray-500">
                                  {team.lost}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                            {team.played > 0
                              ? `${team.pointsWon}-${team.pointsLost}`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(!isTop || !isLowest) && (
                <p className="text-[11px] text-gray-400 mt-2">
                  {!isTop && (
                    <span className="mr-3">
                      <span
                        className={`${DIV_BADGE} bg-green-100 text-green-700 mr-1`}
                      >
                        昇
                      </span>
                      入替戦（昇格）対象の目安
                    </span>
                  )}
                  {!isLowest && (
                    <span>
                      <span
                        className={`${DIV_BADGE} bg-red-100 text-red-700 mr-1`}
                      >
                        降
                      </span>
                      入替戦（降格）対象の目安
                    </span>
                  )}
                </p>
              )}
            </section>

            {/* 対戦結果一覧 */}
            <section>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                {currentDiv?.name} 対戦結果
              </h2>
              <div className="space-y-3">
                {matchesInDiv.map((match) => (
                  <div
                    key={match.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border transition-all ${
                      expanded.has(match.id)
                        ? 'border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900'
                        : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none"
                      onClick={() => toggle(match.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {match.status === 'finished' ? '試合終了' : '予定'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {match.date.replace(/-/g, '/')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 text-right">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamA ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamA)}
                          </span>
                        </div>
                        <div className="px-4 flex flex-col items-center min-w-[80px]">
                          {match.status === 'finished' ? (
                            <div className="flex items-center space-x-2 text-xl font-bold font-mono">
                              <span
                                className={
                                  match.winner === match.teamA
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-400'
                                }
                              >
                                {match.scoreA}
                              </span>
                              <span className="text-gray-300">-</span>
                              <span
                                className={
                                  match.winner === match.teamB
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-400'
                                }
                              >
                                {match.scoreB}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xl font-bold text-gray-300">
                              VS
                            </span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamB ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamB)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className="ml-2 text-xs">
                            {expanded.has(match.id) ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {expanded.has(match.id) && match.status === 'finished' && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                        <div className="space-y-3">
                          {match.matches.map((detail, idx) => (
                            <div
                              key={idx}
                              className="flex items-center text-sm"
                            >
                              <div className="w-8 font-bold text-gray-400 text-xs uppercase text-center">
                                {detail.type}
                              </div>
                              <div
                                className={`flex-1 text-right ${detail.winner === 'A' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                              >
                                {getPlayerNames(detail.playersA)}
                              </div>
                              <div className="px-3">
                                <span className="inline-block px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono font-medium">
                                  {detail.scoreA}-{detail.scoreB}
                                </span>
                              </div>
                              <div
                                className={`flex-1 text-left ${detail.winner === 'B' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                              >
                                {getPlayerNames(detail.playersB)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {expanded.has(match.id) && match.status !== 'finished' && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center text-sm text-gray-500">
                        試合データはまだありません
                      </div>
                    )}
                  </div>
                ))}
                {matchesInDiv.length === 0 && (
                  <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                    まだ試合情報がありません
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* プレーオフ案内 */}
        {meta?.playoff && (
          <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
            <h2 className="font-bold text-amber-800 dark:text-amber-300 mb-1">
              {meta.playoff.name}
            </h2>
            {meta.playoff.period && (
              <p className="text-sm text-amber-700 dark:text-amber-200">
                {meta.playoff.period.start.replace(/-/g, '/')}〜
                {meta.playoff.period.end.replace(/-/g, '/')}
                {meta.playoff.venue && `　${meta.playoff.venue}`}
              </p>
            )}
            {meta.playoff.description && (
              <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
                {meta.playoff.description}
              </p>
            )}
          </section>
        )}

        {/* 他ページ導線 */}
        <nav className="flex flex-wrap gap-3 pt-2">
          <a
            href={`/st-league/${year}/teams`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ 出場チーム・選手を見る
          </a>
          <a
            href={`/st-league/${year}/analysis`}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            ▶ 選手別データ・分析を見る
          </a>
        </nav>
      </PageLayout>
    </>
  );
}

export const getStaticPaths = async () => ({
  paths: getStLeagueYears().map((y) => ({ params: { year: String(y) } })),
  fallback: false,
});

export const getStaticProps = async ({
  params,
}: {
  params: { year: string };
}) => {
  const year = params.year;
  const matches = loadMatches(year);
  const participants = loadParticipants(year);
  if (!matches || !participants) return { notFound: true };

  const meta = loadLeagueMeta(year);
  const divisions = getDivisions(meta);

  const playerMaps = {
    boys: buildPlayerMap(participants.boys),
    girls: buildPlayerMap(participants.girls),
  };

  return {
    props: {
      year: parseInt(year, 10),
      meta,
      divisions,
      matches,
      teams: participants,
      playerMaps,
    },
  };
};
