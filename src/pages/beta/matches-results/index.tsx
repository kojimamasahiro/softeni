import { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getBetaTeamDisplayName, getLatestBetaMatches } from '@/lib/betaMatchesStatic';
import { buildSiteUrl, getPublicMatchDetailPath, getPublicMatchesGrowthPath, getPublicMatchesListPath, isScoreSiteMode } from '@/lib/siteConfig';
import { generateTournamentUrlFromMatch, TournamentInfo } from '@/lib/tournamentClientHelpers';

import { Game, Match } from '../../../types/database';

interface Props {
  matches: Match[];
  tournamentInfos: { [key: string]: TournamentInfo };
}

export function PublicMatchesListPage({ matches, tournamentInfos }: Props) {
  const getTournamentDisplayName = (match: Match, tournamentInfo?: TournamentInfo) => {
    const baseName = tournamentInfo?.meta.name || match.tournament_name || '大会名不明';
    const year = match.tournament_year;

    if (!year) {
      return baseName;
    }

    return `${baseName} ${year}`;
  };

  // 試合の勝者を取得
  const getMatchWinner = (match: Match) => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
    const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;
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
      const hasActiveGame = match.games.some((game: Game) => !game.winner_team || (game.points && game.points.length > 0));
      if (hasActiveGame) return 'in_progress';
    }

    return 'not_started';
  };

  // スコアを取得
  const getScore = (match: Match) => {
    if (!match?.games) return { teamA: 0, teamB: 0 };

    const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
    const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;

    return { teamA: gamesWonA, teamB: gamesWonB };
  };

  return (
    <>
      <MetaHead
        title="試合結果一覧"
        description="ポイント詳細記録から、試合結果と分析ページを確認できます。"
        url={buildSiteUrl(`${getPublicMatchesListPath()}/`)}
        type="website"
      />
      {/* PageLayout+パンくずを適用(docs/ui M4・T2) */}
      <PageLayout maxWidth="6xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '試合一覧', href: getPublicMatchesListPath() },
          ]}
        />
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text">試合結果一覧</h1>
            <p className="mt-2 text-sm text-text-secondary">ポイント詳細記録から、試合結果と分析ページを確認できます。</p>
            <div className="mt-4">
              <Link
                href={getPublicMatchesGrowthPath()}
                className="inline-flex rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                成長分析を見る
              </Link>
            </div>
          </div>
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <ul className="divide-y divide-border">
              {matches.map((match) => (
                <li key={match.id} className="relative">
                  <Link
                    href={getPublicMatchDetailPath(match)}
                    className="block p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                    aria-label={`${getBetaTeamDisplayName(match, 'A')} vs ${getBetaTeamDisplayName(match, 'B')}の試合詳細`}
                  >
                    <div className="relative">
                      <div className="pr-20">
                        <p className="mb-1 text-lg font-medium text-text">
                          {getBetaTeamDisplayName(match, 'A')} vs {getBetaTeamDisplayName(match, 'B')}
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

                        <div className="text-sm text-text-muted">
                          {match.tournament_name && tournamentInfos[match.tournament_name] ? (
                            tournamentInfos[match.tournament_name].exists ? (
                              (() => {
                                const tournamentInfo = tournamentInfos[match.tournament_name];
                                const tournamentUrl = generateTournamentUrlFromMatch(match);
                                return tournamentUrl ? (
                                  <span
                                    className="cursor-pointer text-primary underline hover:text-info"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(tournamentUrl, '_blank');
                                    }}
                                  >
                                    {getTournamentDisplayName(match, tournamentInfo)}
                                  </span>
                                ) : (
                                  <span className="text-text-secondary">{getTournamentDisplayName(match, tournamentInfo)}</span>
                                );
                              })()
                            ) : (
                              <span className="text-text-secondary">{getTournamentDisplayName(match, tournamentInfos[match.tournament_name])}</span>
                            )
                          ) : (
                            <span className="text-text-secondary">{getTournamentDisplayName(match)}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          {match.round_name && (
                            <span className="rounded bg-bg-subtle px-2 py-1 text-xs text-gray-700 dark:text-gray-200">{match.round_name}</span>
                          )}
                          {(() => {
                            const status = getMatchStatus(match);
                            const winner = getMatchWinner(match);

                            if (status === 'finished' && winner) {
                              return <span className="rounded bg-success-bg px-2 py-1 text-xs font-medium text-success">終了</span>;
                            } else if (status === 'in_progress') {
                              return <span className="rounded bg-info-bg px-2 py-1 text-xs font-medium text-info">進行中</span>;
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      <div className="absolute bottom-0 right-0">
                        <p className="text-xs text-text-muted">
                          {new Date(match.created_at).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            timeZone: 'Asia/Tokyo',
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {matches.length === 0 && (
              <div className="py-12 text-center">
                <span className="text-text-secondary">まだ試合が登録されていません。</span>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    </>
  );
}

export const getPublicMatchesListStaticProps: GetStaticProps<Props> = async (context?) => {
  void context;
  try {
    const safeMatches = await getLatestBetaMatches();
    const tournamentIds = [...new Set(safeMatches.map((m) => m.tournament_name).filter(Boolean))] as string[];
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

export const getStaticProps: GetStaticProps<Props> = async () => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicMatchesListStaticProps({} as never);
};

export default PublicMatchesListPage;
