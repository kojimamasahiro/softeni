import { GetStaticProps } from 'next';
import Link from 'next/link';

import {
  getBetaTeamDisplayName,
  getLatestBetaMatches,
} from '@/lib/betaMatchesStatic';
import {
  generateTournamentUrlFromMatch,
  TournamentInfo,
} from '@/lib/tournamentClientHelpers';

import { Game, Match } from '../../../types/database';

interface Props {
  matches: Match[];
  tournamentInfos: { [key: string]: TournamentInfo };
}

export default function MatchesList({ matches, tournamentInfos }: Props) {
  const getTournamentDisplayName = (
    match: Match,
    tournamentInfo?: TournamentInfo,
  ) => {
    const baseName =
      tournamentInfo?.meta.name || match.tournament_name || '大会名不明';
    const year = match.tournament_year;

    if (!year) {
      return baseName;
    }

    return `${baseName} ${year}`;
  };

  // 試合の勝者を取得
  const getMatchWinner = (match: Match) => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  // 試合の状態を取得
  const getMatchStatus = (match: Match) => {
    const winner = getMatchWinner(match);
    if (winner) return 'finished';

    // ゲームが存在し、何らかのポイントやデータがある場合は進行中
    if (match?.games && match.games.length > 0) {
      // 勝者が決まっていないゲームがあるか、進行中のゲームがあるかチェック
      const hasActiveGame = match.games.some(
        (game: Game) =>
          !game.winner_team || (game.points && game.points.length > 0),
      );
      if (hasActiveGame) return 'in_progress';
    }

    return 'not_started';
  };

  // スコアを取得
  const getScore = (match: Match) => {
    if (!match?.games) return { teamA: 0, teamB: 0 };

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;

    return { teamA: gamesWonA, teamB: gamesWonB };
  };

  return (
    <div className="min-h-screen bg-white px-4 py-10 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            試合結果一覧
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            ベータ版のポイント詳細記録から、試合結果と分析ページを確認できます。
          </p>
          <div className="mt-4">
            <Link
              href="/beta/matches-results/growth"
              className="inline-flex rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              成長分析を見る
            </Link>
          </div>
        </div>
        <div className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {matches.map((match) => (
              <li key={match.id} className="relative">
                <Link
                  href={`/beta/matches-results/${match.id}`}
                  className="block p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                  aria-label={`${getBetaTeamDisplayName(
                    match,
                    'A',
                  )} vs ${getBetaTeamDisplayName(match, 'B')}の試合詳細`}
                >
                  <div className="relative">
                    <div className="pr-20">
                      <p className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
                        {getBetaTeamDisplayName(match, 'A')} vs{' '}
                        {getBetaTeamDisplayName(match, 'B')}
                      </p>

                      {/* スコア表示 */}
                      {(() => {
                        const score = getScore(match);
                        const status = getMatchStatus(match);

                        if (status !== 'not_started') {
                          return (
                            <div className="mb-1 font-mono text-sm text-gray-700 dark:text-gray-200">
                              {score.teamA} - {score.teamB}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {match.tournament_name &&
                        tournamentInfos[match.tournament_name] ? (
                          tournamentInfos[match.tournament_name].exists ? (
                            (() => {
                              const tournamentInfo =
                                tournamentInfos[match.tournament_name];
                              const tournamentUrl =
                                generateTournamentUrlFromMatch(match);
                              return tournamentUrl ? (
                                <span
                                  className="cursor-pointer text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(tournamentUrl, '_blank');
                                  }}
                                >
                                  {getTournamentDisplayName(
                                    match,
                                    tournamentInfo,
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300">
                                  {getTournamentDisplayName(
                                    match,
                                    tournamentInfo,
                                  )}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300">
                              {getTournamentDisplayName(
                                match,
                                tournamentInfos[match.tournament_name],
                              )}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-600 dark:text-gray-300">
                            {getTournamentDisplayName(match)}
                          </span>
                        )}
                      </div>

                      {/* 回戦情報と試合状態を横並びに */}
                      <div className="flex items-center gap-2 mt-1">
                        {match.round_name && (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {match.round_name}
                          </span>
                        )}
                        {/* 試合状態 */}
                        {(() => {
                          const status = getMatchStatus(match);
                          const winner = getMatchWinner(match);

                          if (status === 'finished' && winner) {
                            return (
                              <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                終了
                              </span>
                            );
                          } else if (status === 'in_progress') {
                            return (
                              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                進行中
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* 日時を右下に配置 */}
                    <div className="absolute bottom-0 right-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(match.created_at).toLocaleDateString(
                          'ja-JP',
                          {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            timeZone: 'Asia/Tokyo',
                          },
                        )}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {matches.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                まだ試合が登録されていません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  try {
    const safeMatches = await getLatestBetaMatches();
    const tournamentIds = [
      ...new Set(safeMatches.map((m) => m.tournament_name).filter(Boolean)),
    ] as string[];
    const tournamentInfos: { [key: string]: TournamentInfo } = {};

    await Promise.all(
      tournamentIds.map(async (id) => {
        try {
          const helpers = await import('@/lib/tournamentHelpers.server');
          const info = await helpers.getTournamentInfoSSR(id);
          if (info) tournamentInfos[id] = info;
        } catch (e) {
          console.error(`Tournament fetch failed: ${id}`, e);
        }
      }),
    );

    return {
      props: {
        matches: safeMatches,
        tournamentInfos,
      },
    };
  } catch (error) {
    console.error('getStaticProps error:', error);
    return {
      props: {
        matches: [],
        tournamentInfos: {},
      },
    };
  }
};
