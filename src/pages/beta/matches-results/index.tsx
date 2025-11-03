import { GetStaticProps } from 'next';
import Link from 'next/link';

import { createServerClient } from '@/lib/supabase';
import {
  generateTournamentUrlFromMatch,
  getTournamentInfoSSR,
  TournamentInfo,
} from '@/lib/tournamentHelpers';

import { Game, Match } from '../../../types/database';

interface Props {
  matches: Match[];
  tournamentInfos: { [key: string]: TournamentInfo };
  lastUpdated: string;
}

export default function MatchesList({
  matches,
  tournamentInfos,
  lastUpdated,
}: Props) {
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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900">試合結果一覧</h1>
        <p className="mt-2 text-sm text-gray-600">
          最終更新:{' '}
          {new Date(lastUpdated).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          })}
        </p>
        <div className="mt-8 bg-white shadow rounded-lg">
          <ul className="divide-y divide-gray-200">
            {matches.map((match) => (
              <li key={match.id} className="relative">
                <Link
                  href={`/beta/matches-results/${match.id}`}
                  className="block p-4 hover:bg-gray-50"
                  aria-label={`${match.team_a} vs ${match.team_b}の試合詳細`}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="text-lg font-medium mb-1">
                        {match.team_a} vs {match.team_b}
                      </p>

                      {/* スコア表示 */}
                      {(() => {
                        const score = getScore(match);
                        const status = getMatchStatus(match);

                        if (status !== 'not_started') {
                          return (
                            <div className="text-sm font-mono text-gray-700 mb-1">
                              {score.teamA} - {score.teamB}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="text-sm text-gray-500">
                        {match.tournament_name &&
                        tournamentInfos[match.tournament_name] ? (
                          tournamentInfos[match.tournament_name].exists ? (
                            (() => {
                              const tournamentUrl =
                                generateTournamentUrlFromMatch(match);
                              return tournamentUrl ? (
                                <span
                                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(tournamentUrl, '_blank');
                                  }}
                                >
                                  {
                                    tournamentInfos[match.tournament_name].meta
                                      .name
                                  }
                                </span>
                              ) : (
                                <span className="text-gray-600">
                                  {
                                    tournamentInfos[match.tournament_name].meta
                                      .name
                                  }
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-gray-600">
                              {tournamentInfos[match.tournament_name].meta.name}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-600">
                            {match.tournament_name || '大会名不明'}
                          </span>
                        )}
                      </div>

                      {/* 回戦情報と試合状態を横並びに */}
                      <div className="flex items-center gap-2 mt-1">
                        {match.round_name && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {match.round_name}
                          </span>
                        )}
                        {/* 試合状態 */}
                        {(() => {
                          const status = getMatchStatus(match);
                          const winner = getMatchWinner(match);

                          if (status === 'finished' && winner) {
                            return (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                終了
                              </span>
                            );
                          } else if (status === 'in_progress') {
                            return (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                進行中
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
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
              <p className="text-gray-500">まだ試合が登録されていません。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  try {
    const supabase = createServerClient();
    const { data: matches, error } = await supabase
      .from('matches')
      .select(
        `
        *,
        games(*, points(*))
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const safeMatches = matches || [];
    const tournamentIds = [
      ...new Set(safeMatches.map((m) => m.tournament_name).filter(Boolean)),
    ] as string[];
    const tournamentInfos: { [key: string]: TournamentInfo } = {};

    await Promise.all(
      tournamentIds.map(async (id) => {
        try {
          const info = await getTournamentInfoSSR(id);
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
        lastUpdated: new Date().toISOString(),
      },
      revalidate: 60, // ISR: 60秒ごとに再生成
    };
  } catch (error) {
    console.error('getStaticProps error:', error);
    return {
      props: {
        matches: [],
        tournamentInfos: {},
        lastUpdated: new Date().toISOString(),
      },
      revalidate: 30,
    };
  }
};
