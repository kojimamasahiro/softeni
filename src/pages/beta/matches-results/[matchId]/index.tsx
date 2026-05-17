import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AnalysisGuideCard,
  AnalysisReliability,
  ImprovementHint,
  analyzeMatch,
  MatchAnalysisSummary,
  RateMetric,
  TeamKey,
} from '@/lib/matchAnalysis';
import {
  getBetaMatchById,
  getBetaTeamDisplayName,
  getLatestBetaMatchIds,
} from '@/lib/betaMatchesStatic';
import { generateTournamentUrlFromMatch } from '@/lib/tournamentHelpers';
import {
  getTournamentInfoSSR,
  TournamentInfo,
} from '@/lib/tournamentHelpers.server';

import { Game, Match, Point } from '../../../../types/database';

interface PublicMatchDetailProps {
  match: Match;
  tournamentInfo: TournamentInfo | null;
}

const PublicMatchDetail = ({
  match,
  tournamentInfo,
}: PublicMatchDetailProps) => {
  const router = useRouter();

  const getTournamentDisplayName = () => {
    const baseName =
      tournamentInfo?.meta.name || match.tournament_name || '大会名不明';
    const year = match.tournament_year;

    if (!year) {
      return baseName;
    }

    return `${baseName} ${year}`;
  };

  // マッチ勝者を判定する関数を先に定義
  const getMatchWinner = useCallback(() => {
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
  }, [match]);

  // エキスパンド状態管理（最新ゲームのみ展開）
  const [expandedGames, setExpandedGames] = useState<Set<number>>(
    new Set(
      match?.games && match.games.length > 0
        ? [Math.max(...match.games.map((g) => g.game_number))]
        : [],
    ),
  );
  const [focusTeam, setFocusTeam] = useState<TeamKey>('A');

  useEffect(() => {
    if (!router.isReady) return;

    const queryTeam = router.query.focusTeam;
    if (queryTeam === 'A' || queryTeam === 'B') {
      setFocusTeam(queryTeam);
    }
  }, [router.isReady, router.query.focusTeam]);

  // エキスパンドのトグル関数
  const toggleGameExpansion = (gameNumber: number) => {
    const newExpandedGames = new Set(expandedGames);
    if (newExpandedGames.has(gameNumber)) {
      newExpandedGames.delete(gameNumber);
    } else {
      newExpandedGames.add(gameNumber);
    }
    setExpandedGames(newExpandedGames);
  };

  // マッチデータから完全なURLを生成
  const fullTournamentUrl = generateTournamentUrlFromMatch(match);
  const analysisSummary = useMemo<MatchAnalysisSummary>(
    () => analyzeMatch(match),
    [match],
  );
  const gamesAsc = useMemo(
    () =>
      [...(match.games ?? [])].sort((a, b) => a.game_number - b.game_number),
    [match.games],
  );
  const gamesDesc = useMemo(
    () => [...gamesAsc].sort((a, b) => b.game_number - a.game_number),
    [gamesAsc],
  );

  // データベースのプレイヤー情報から苗字のみのチーム名を生成する関数
  const getShortTeamName = (team: 'A' | 'B') =>
    getBetaTeamDisplayName(match, team);

  const teamAPlayers = useMemo(
    () =>
      [
        match.team_a_player1_first_name && match.team_a_player1_last_name
          ? `${match.team_a_player1_last_name} ${match.team_a_player1_first_name}`
          : null,
        match.team_a_player2_first_name && match.team_a_player2_last_name
          ? `${match.team_a_player2_last_name} ${match.team_a_player2_first_name}`
          : null,
      ].filter((player): player is string => player !== null),
    [
      match.team_a_player1_first_name,
      match.team_a_player1_last_name,
      match.team_a_player2_first_name,
      match.team_a_player2_last_name,
    ],
  );
  const teamBPlayers = useMemo(
    () =>
      [
        match.team_b_player1_first_name && match.team_b_player1_last_name
          ? `${match.team_b_player1_last_name} ${match.team_b_player1_first_name}`
          : null,
        match.team_b_player2_first_name && match.team_b_player2_last_name
          ? `${match.team_b_player2_last_name} ${match.team_b_player2_first_name}`
          : null,
      ].filter((player): player is string => player !== null),
    [
      match.team_b_player1_first_name,
      match.team_b_player1_last_name,
      match.team_b_player2_first_name,
      match.team_b_player2_last_name,
    ],
  );

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      // ウィナー系
      smash_winner: 'スマッシュウィナー',
      volley_winner: 'ボレーウィナー',
      passing_winner: 'パッシングウィナー',
      drop_winner: 'ドロップウィナー',
      net_in_winner: 'ネットインウィナー',
      service_ace: 'サービスエース',

      // ミス系
      net: 'ネット',
      out: 'アウト',
      smash_error: 'スマッシュミス',
      volley_error: 'ボレーミス',
      double_fault: 'ダブルフォルト',
      follow_error: 'フォローミス',
      receive_error: 'レシーブミス',

      // その他
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
    };
    return labels[type] || type;
  };

  const formatRateMetric = (metric: RateMetric) => {
    if (metric.denominator === 0 || metric.percentage === null) {
      return '—';
    }
    return `${metric.percentage.toFixed(1)}% (${metric.numerator}/${metric.denominator})`;
  };

  const formatCountMetric = (
    count: number,
    segment?: {
      startGameNumber: number;
      endGameNumber: number;
    } | null,
  ) => {
    if (!segment) return `${count}点`;
    return `${count}点 (第${segment.startGameNumber}〜第${segment.endGameNumber}ゲーム)`;
  };

  const getReliabilityBadge = (reliability: AnalysisReliability) => {
    if (reliability === 'low') {
      return {
        label: '参考値',
        className:
          'border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }
    if (reliability === 'none') {
      return {
        label: 'データ不足',
        className:
          'border border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-300',
      };
    }
    return null;
  };

  const getHintConfidenceBadge = (
    confidence: ImprovementHint['confidence'],
  ) => {
    if (confidence === 'low') {
      return {
        label: '参考',
        className:
          'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }
    if (confidence === 'high') {
      return {
        label: '注目',
        className:
          'border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
      };
    }
    return {
      label: '確認',
      className:
        'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    };
  };

  const formatHintMetricValue = (
    metric: ImprovementHint['sourceMetrics'][number],
  ) => {
    if (metric.value === '--') return '--';
    if (metric.unit === '%' && typeof metric.value === 'number') {
      return `${metric.value.toFixed(1)}%`;
    }
    if (metric.unit === 'points') return `${metric.value}点`;
    if (metric.unit === 'count') return `${metric.value}件`;
    return String(metric.value);
  };

  const formatGuideDetailLabel = (label: string) => {
    const detailLabelMap: Record<string, string> = {
      net: 'ネット',
      out: 'アウト',
      smash_error: 'スマッシュミス',
      volley_error: 'ボレーミス',
      double_fault: 'ダブルフォルト',
      follow_error: 'フォローミス',
      receive_error: 'レシーブミス',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
    };

    if (label.startsWith('自チームの確認ポイント: ')) {
      const rawType = label.replace('自チームの確認ポイント: ', '');
      return `自チームの確認ポイント: ${detailLabelMap[rawType] || rawType}`;
    }

    return label;
  };

  const getPointsDesc = useCallback(
    (game: Game) =>
      [...(game.points ?? [])].sort((a, b) => b.point_number - a.point_number),
    [],
  );

  useEffect(() => {
    if (!analysisSummary.scoreIntegrity.ok) {
      console.error(
        'Match analysis score integrity mismatch:',
        analysisSummary.scoreIntegrity.mismatches,
      );
    }
  }, [analysisSummary]);

  // 試合全体の統計を計算する関数
  const getMatchStats = () => {
    if (!match?.games) return null;

    const rallyCounts: number[] = [];
    let totalPoints = 0;
    let winnersTotal = 0;
    let errorsTotal = 0;
    let totalRallies = 0;

    // モメンタム分析のためのデータ
    const allPoints: Array<{ winner_team: string; game_number: number }> = [];

    match.games.forEach((game) => {
      if (!game.points) return;

      totalPoints += game.points.length;

      game.points.forEach((point) => {
        if (point.winner_team) {
          allPoints.push({
            winner_team: point.winner_team,
            game_number: game.game_number,
          });
        }

        if (point.rally_count !== null && point.rally_count > 0) {
          rallyCounts.push(point.rally_count);
          totalRallies += point.rally_count;
        }

        const resultType = point.result_type || '';
        const winnerTypes = [
          'smash_winner',
          'volley_winner',
          'passing_winner',
          'drop_winner',
          'net_in_winner',
          'service_ace',
        ];
        const errorTypes = [
          'net',
          'out',
          'smash_error',
          'volley_error',
          'double_fault',
          'follow_error',
          'receive_error',
        ];

        if (winnerTypes.includes(resultType)) {
          winnersTotal++;
        } else if (errorTypes.includes(resultType)) {
          errorsTotal++;
        }
      });
    });

    const maxRally = rallyCounts.length > 0 ? Math.max(...rallyCounts) : 0;
    const avgRally =
      rallyCounts.length > 0 ? totalRallies / rallyCounts.length : 0;

    // 最長ラリーの詳細情報を取得
    let maxRallyDetails: { gameNumber: number; pointNumber: number } | null =
      null;
    if (maxRally > 0) {
      match.games.forEach((game) => {
        if (!game.points) return;

        game.points.forEach((point) => {
          if (point.rally_count === maxRally && !maxRallyDetails) {
            maxRallyDetails = {
              gameNumber: game.game_number,
              pointNumber: point.point_number,
            };
          }
        });
      });
    }

    // ラリー数分布の計算
    const rallyDistribution: { [range: string]: number } = {
      '1-3': 0,
      '4-10': 0,
      '11-20': 0,
      '21+': 0,
    };

    rallyCounts.forEach((count) => {
      if (count <= 3) rallyDistribution['1-3']++;
      else if (count <= 10) rallyDistribution['4-10']++;
      else if (count <= 20) rallyDistribution['11-20']++;
      else rallyDistribution['21+']++;
    });

    // モメンタム分析：最長連続ポイント
    let maxStreakA = 0;
    let maxStreakB = 0;
    let currentStreakA = 0;
    let currentStreakB = 0;

    allPoints.forEach((point) => {
      if (point.winner_team === 'A') {
        currentStreakA++;
        currentStreakB = 0;
        maxStreakA = Math.max(maxStreakA, currentStreakA);
      } else if (point.winner_team === 'B') {
        currentStreakB++;
        currentStreakA = 0;
        maxStreakB = Math.max(maxStreakB, currentStreakB);
      }
    });

    return {
      totalPoints,
      winnersTotal,
      errorsTotal,
      maxRally,
      maxRallyDetails,
      avgRally,
      rallyDistribution,
      winnerErrorRatio:
        errorsTotal > 0 ? winnersTotal / errorsTotal : winnersTotal,
      totalGames: match.games.length,
      totalRallies,
      maxStreakA,
      maxStreakB,
      rallyCountsArray: rallyCounts,
    };
  };

  // 選手統計を計算する関数
  const getPlayerStats = () => {
    if (!match?.games) return {};

    const stats: {
      [playerName: string]: {
        winners: number;
        errors: number;
        points: number;
        winnerBreakdown: {
          [winnerType: string]: number;
        };
        errorBreakdown: {
          [errorType: string]: number;
        };
        serves: {
          total: number;
          aces: number;
          doubleFaults: number;
          firstServeFaults: number;
          firstServeSuccess: number;
        };
        gameStats: {
          [gameNumber: number]: {
            winners: number;
            errors: number;
            points: number;
          };
        };
      };
    } = {};

    // ウィナー系の結果タイプ
    const winnerTypes = [
      'smash_winner',
      'volley_winner',
      'passing_winner',
      'drop_winner',
      'net_in_winner',
      'service_ace',
    ];

    // ミス系の結果タイプ
    const errorTypes = [
      'net',
      'out',
      'smash_error',
      'volley_error',
      'double_fault',
      'follow_error',
      'receive_error',
    ];

    match.games.forEach((game) => {
      if (!game.points) return;

      game.points.forEach((point) => {
        const resultType = point.result_type || '';

        // ウィナー系の処理
        if (winnerTypes.includes(resultType)) {
          let playerName = point.winner_player;

          // 一意識別子から選手名を抽出
          if (playerName && playerName.includes('-')) {
            const parts = playerName.split('-');
            playerName = parts.slice(2).join('-');
          }

          if (playerName) {
            // プレイヤー統計初期化
            if (!stats[playerName]) {
              stats[playerName] = {
                winners: 0,
                errors: 0,
                points: 0,
                winnerBreakdown: {},
                errorBreakdown: {},
                serves: {
                  total: 0,
                  aces: 0,
                  doubleFaults: 0,
                  firstServeFaults: 0,
                  firstServeSuccess: 0,
                },
                gameStats: {},
              };
            }

            // ゲーム統計初期化
            if (!stats[playerName].gameStats[game.game_number]) {
              stats[playerName].gameStats[game.game_number] = {
                winners: 0,
                errors: 0,
                points: 0,
              };
            }

            stats[playerName].winners++;
            stats[playerName].gameStats[game.game_number].winners++;
            stats[playerName].points++;
            stats[playerName].gameStats[game.game_number].points++;

            // ウィナーの内訳を記録
            if (!stats[playerName].winnerBreakdown[resultType]) {
              stats[playerName].winnerBreakdown[resultType] = 0;
            }
            stats[playerName].winnerBreakdown[resultType]++;
          }
        }

        // ミス系の処理
        if (errorTypes.includes(resultType)) {
          let playerName = point.loser_player;

          // 一意識別子から選手名を抽出
          if (playerName && playerName.includes('-')) {
            const parts = playerName.split('-');
            playerName = parts.slice(2).join('-');
          }

          if (playerName) {
            // プレイヤー統計初期化
            if (!stats[playerName]) {
              stats[playerName] = {
                winners: 0,
                errors: 0,
                points: 0,
                winnerBreakdown: {},
                errorBreakdown: {},
                serves: {
                  total: 0,
                  aces: 0,
                  doubleFaults: 0,
                  firstServeFaults: 0,
                  firstServeSuccess: 0,
                },
                gameStats: {},
              };
            }

            // ゲーム統計初期化
            if (!stats[playerName].gameStats[game.game_number]) {
              stats[playerName].gameStats[game.game_number] = {
                winners: 0,
                errors: 0,
                points: 0,
              };
            }

            stats[playerName].errors++;
            stats[playerName].gameStats[game.game_number].errors++;
            stats[playerName].points++;
            stats[playerName].gameStats[game.game_number].points++;

            // ミスの内訳を記録
            if (!stats[playerName].errorBreakdown[resultType]) {
              stats[playerName].errorBreakdown[resultType] = 0;
            }
            stats[playerName].errorBreakdown[resultType]++;
          }
        }
      });

      // サーブ統計の計算
      game.points.forEach((point) => {
        const servingPlayerName = point.serving_player;

        if (!servingPlayerName) return;

        // サーブ選手の統計初期化
        if (!stats[servingPlayerName]) {
          stats[servingPlayerName] = {
            winners: 0,
            errors: 0,
            points: 0,
            winnerBreakdown: {},
            errorBreakdown: {},
            serves: {
              total: 0,
              aces: 0,
              doubleFaults: 0,
              firstServeFaults: 0,
              firstServeSuccess: 0,
            },
            gameStats: {},
          };
        }

        // サーブ統計の計算
        stats[servingPlayerName].serves.total++;

        // サービスエース
        if (point.result_type === 'service_ace') {
          stats[servingPlayerName].serves.aces++;
        }

        // ダブルフォルト
        if (point.double_fault || point.result_type === 'double_fault') {
          stats[servingPlayerName].serves.doubleFaults++;
        }

        // ダブルフォルトの場合、loser_playerも考慮（serving_playerが不正確な場合の補完）
        if (
          (point.double_fault || point.result_type === 'double_fault') &&
          point.loser_player &&
          point.loser_player !== servingPlayerName
        ) {
          const loserPlayerName = point.loser_player;
          if (!stats[loserPlayerName]) {
            stats[loserPlayerName] = {
              winners: 0,
              errors: 0,
              points: 0,
              winnerBreakdown: {},
              errorBreakdown: {},
              serves: {
                total: 0,
                aces: 0,
                doubleFaults: 0,
                firstServeFaults: 0,
                firstServeSuccess: 0,
              },
              gameStats: {},
            };
          }
          stats[loserPlayerName].serves.total++;
          stats[loserPlayerName].serves.doubleFaults++;
        }

        // 1stサーブフォルト
        if (point.first_serve_fault) {
          stats[servingPlayerName].serves.firstServeFaults++;
        } else {
          // 1stサーブ成功（フォルトしていない場合）
          stats[servingPlayerName].serves.firstServeSuccess++;
        }
      });
    });

    return stats;
  };

  if (!match)
    return (
      <div className="p-6 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        Match not found
      </div>
    );

  const matchWinner = getMatchWinner();
  const gamesWonA = gamesAsc.filter((game) => game.winner_team === 'A').length;
  const gamesWonB = gamesAsc.filter((game) => game.winner_team === 'B').length;
  const recordedDate = new Date(match.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
  const focusedImprovementHints = analysisSummary.improvementHints[focusTeam];
  const comparisonRows = [
    {
      label: '1stサーブ成功率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.service.firstServeSuccessRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.service.firstServeSuccessRate,
      ),
    },
    {
      label: '1stサーブ時得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.service.firstServePointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.service.firstServePointWinRate,
      ),
    },
    {
      label: '2ndサーブ時得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.service.secondServePointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.service.secondServePointWinRate,
      ),
    },
    {
      label: 'ダブルフォルト数',
      a: `${analysisSummary.neutralComparison.A.service.doubleFaultCount}件`,
      b: `${analysisSummary.neutralComparison.B.service.doubleFaultCount}件`,
    },
    {
      label: 'レシーブ時得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.receive.pointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.receive.pointWinRate,
      ),
    },
    {
      label: '各ゲーム1ポイント目取得率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.keyMoments.firstPointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.keyMoments.firstPointWinRate,
      ),
    },
    {
      label: '2-2局面取得率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.keyMoments.twoTwoPointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.keyMoments.twoTwoPointWinRate,
      ),
    },
    {
      label: 'デュースポイント取得率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.keyMoments.deucePointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.keyMoments.deucePointWinRate,
      ),
    },
    {
      label: 'ゲームポイント取得率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.keyMoments.gamePointWinRate,
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.keyMoments.gamePointWinRate,
      ),
    },
    {
      label: '1-2本ラリー得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.rally.buckets['1-2'],
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.rally.buckets['1-2'],
      ),
    },
    {
      label: '3-4本ラリー得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.rally.buckets['3-4'],
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.rally.buckets['3-4'],
      ),
    },
    {
      label: '5-8本ラリー得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.rally.buckets['5-8'],
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.rally.buckets['5-8'],
      ),
    },
    {
      label: '9本以上ラリー得点率',
      a: formatRateMetric(
        analysisSummary.neutralComparison.A.rally.buckets['9+'],
      ),
      b: formatRateMetric(
        analysisSummary.neutralComparison.B.rally.buckets['9+'],
      ),
    },
    {
      label: '最大連続得点',
      a: formatCountMetric(
        analysisSummary.neutralComparison.A.momentum.maxStreakFor,
        analysisSummary.neutralComparison.A.momentum.maxStreakForSegment,
      ),
      b: formatCountMetric(
        analysisSummary.neutralComparison.B.momentum.maxStreakFor,
        analysisSummary.neutralComparison.B.momentum.maxStreakForSegment,
      ),
    },
    {
      label: '最大連続失点',
      a: formatCountMetric(
        analysisSummary.neutralComparison.A.momentum.maxStreakAgainst,
        analysisSummary.neutralComparison.A.momentum.maxStreakAgainstSegment,
      ),
      b: formatCountMetric(
        analysisSummary.neutralComparison.B.momentum.maxStreakAgainst,
        analysisSummary.neutralComparison.B.momentum.maxStreakAgainstSegment,
      ),
    },
    {
      label: 'ウィナー数',
      a: `${analysisSummary.neutralComparison.A.endings.winners}件`,
      b: `${analysisSummary.neutralComparison.B.endings.winners}件`,
    },
    {
      label: 'ミス数',
      a: `${analysisSummary.neutralComparison.A.endings.errors}件`,
      b: `${analysisSummary.neutralComparison.B.endings.errors}件`,
    },
  ];

  const renderScoreboard = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-600">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/90">
            <th className="w-auto border border-gray-300 px-3 py-2 text-left dark:border-gray-600">
              チーム
            </th>
            {gamesAsc.map((game) => (
              <th
                key={game.game_number}
                className="min-w-12 border border-gray-300 px-3 py-2 text-center dark:border-gray-600"
              >
                {game.game_number}
              </th>
            ))}
            <th className="border border-gray-300 bg-yellow-50 px-3 py-2 text-center font-bold dark:border-gray-600 dark:bg-yellow-900/30">
              G
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
            <td className="w-auto whitespace-nowrap border border-gray-300 px-3 py-2 font-medium dark:border-gray-600">
              {getShortTeamName('A')}
            </td>
            {gamesAsc.map((game) => (
              <td
                key={game.game_number}
                className={`border border-gray-300 px-3 py-2 text-center dark:border-gray-600 ${
                  game.winner_team === 'A'
                    ? 'bg-green-100 font-bold text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'font-normal dark:text-gray-200'
                }`}
              >
                {game.points_a}
              </td>
            ))}
            <td
              className={`border border-gray-300 bg-yellow-50 px-3 py-2 text-center dark:border-gray-600 dark:bg-yellow-900/30 ${
                matchWinner === 'A'
                  ? 'font-bold dark:text-yellow-100'
                  : 'font-normal dark:text-gray-200'
              }`}
            >
              {gamesWonA}
            </td>
          </tr>
          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
            <td className="w-auto whitespace-nowrap border border-gray-300 px-3 py-2 font-medium dark:border-gray-600">
              {getShortTeamName('B')}
            </td>
            {gamesAsc.map((game) => (
              <td
                key={game.game_number}
                className={`border border-gray-300 px-3 py-2 text-center dark:border-gray-600 ${
                  game.winner_team === 'B'
                    ? 'bg-green-100 font-bold text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'font-normal dark:text-gray-200'
                }`}
              >
                {game.points_b}
              </td>
            ))}
            <td
              className={`border border-gray-300 bg-yellow-50 px-3 py-2 text-center dark:border-gray-600 dark:bg-yellow-900/30 ${
                matchWinner === 'B'
                  ? 'font-bold dark:text-yellow-100'
                  : 'font-normal dark:text-gray-200'
              }`}
            >
              {gamesWonB}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl bg-white p-6 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <Link
          href="/beta/matches-results"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 試合一覧に戻る
        </Link>
      </div>

      {/* 試合サマリー */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              試合サマリー
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {getShortTeamName('A')} vs {getShortTeamName('B')}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {tournamentInfo && fullTournamentUrl ? (
                <Link
                  href={fullTournamentUrl}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {getTournamentDisplayName()}
                </Link>
              ) : tournamentInfo ? (
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {getTournamentDisplayName()}
                </span>
              ) : (
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {getTournamentDisplayName()}
                </span>
              )}
              {match.round_name && (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {match.round_name}
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                記録日 {recordedDate}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3 text-center dark:bg-gray-700/50">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              ゲームカウント
            </div>
            <div className="mt-1 font-mono text-3xl font-bold text-gray-900 dark:text-gray-100">
              {gamesWonA} - {gamesWonB}
            </div>
          </div>
        </div>

        {matchWinner && (
          <div className="mb-5 rounded border border-green-300 bg-green-100 p-4 dark:border-green-800 dark:bg-green-900/30">
            <p className="text-lg font-semibold text-green-800 dark:text-green-300">
              {getShortTeamName(matchWinner)} の勝利
            </p>
          </div>
        )}

        {renderScoreboard()}
      </div>

      <section className="mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                振り返りポイント
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                記録済みポイントから、次に見返す場面を絞るための要点です。
              </p>
            </div>
          </div>

          {!analysisSummary.scoreIntegrity.ok && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              分析用に再構築したゲームスコアが既存スコアと一致しなかったため、分析表示を停止しています。
              <ul className="mt-2 list-disc list-inside">
                {analysisSummary.scoreIntegrity.mismatches.map((mismatch) => (
                  <li key={mismatch.gameNumber}>
                    第{mismatch.gameNumber}ゲーム: 既存
                    {` ${mismatch.expected.pointsA}-${mismatch.expected.pointsB} / `}
                    再構築
                    {` ${mismatch.actual.pointsA}-${mismatch.actual.pointsB}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysisSummary.scoreIntegrity.ok && (
            <>
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                <h3 className="mb-2 font-semibold text-gray-800 dark:text-gray-100">
                  分析の見方
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  この分析は、試合のポイント記録から見返しやすい手がかりをまとめたものです。数字は評価ではなく、次にどの場面を確認するかを考える入口として使います。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  注目チーム
                </span>
                {(['A', 'B'] as TeamKey[]).map((team) => (
                  <button
                    key={team}
                    onClick={() => {
                      setFocusTeam(team);
                      void router.replace(
                        {
                          pathname: router.pathname,
                          query: {
                            ...router.query,
                            focusTeam: team,
                          },
                        },
                        undefined,
                        { shallow: true, scroll: false },
                      );
                    }}
                    className={`px-4 py-2 rounded border text-sm ${
                      focusTeam === team
                        ? team === 'A'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-green-600 text-white border-green-600'
                        : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {getShortTeamName(team)}
                  </button>
                ))}
              </div>

              {focusedImprovementHints.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      この試合から見る改善ヒント
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      1試合分の記録から、次に確認しやすい候補を最大3件に絞っています。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {focusedImprovementHints.map((hint) => {
                      const confidenceBadge = getHintConfidenceBadge(
                        hint.confidence,
                      );

                      return (
                        <div
                          key={hint.id}
                          className="rounded-lg border border-blue-100 bg-blue-50/60 p-5 dark:border-blue-900/60 dark:bg-blue-950/20"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h4 className="font-semibold leading-snug text-gray-900 dark:text-gray-100">
                              {hint.title}
                            </h4>
                            <span
                              className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${confidenceBadge.className}`}
                            >
                              {confidenceBadge.label}
                            </span>
                          </div>

                          <div className="space-y-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
                            <p>{hint.evidence}</p>
                            {hint.evidenceItems &&
                              hint.evidenceItems.length > 0 && (
                                <ul className="space-y-1">
                                  {hint.evidenceItems.map((item) => (
                                    <li
                                      key={`${hint.id}-${item}`}
                                      className="rounded bg-white/70 px-3 py-2 text-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                                    >
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}

                            <div>
                              <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                                読み取り
                              </div>
                              <p>{hint.interpretation}</p>
                            </div>

                            <div>
                              <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                                次に見ること
                              </div>
                              <p>{hint.nextCheck}</p>
                              {hint.nextCheckItems &&
                                hint.nextCheckItems.length > 0 && (
                                  <ul className="mt-2 list-disc space-y-1 pl-5">
                                    {hint.nextCheckItems.map((item) => (
                                      <li key={`${hint.id}-${item}`}>{item}</li>
                                    ))}
                                  </ul>
                                )}
                            </div>

                            {hint.sourceMetrics.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {hint.sourceMetrics.map((metric) => (
                                  <span
                                    key={`${hint.id}-${metric.key}-${metric.label ?? metric.value}`}
                                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {metric.label ?? metric.key}:{' '}
                                    <span className="font-semibold">
                                      {formatHintMetricValue(metric)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {hint.confidence === 'low' && (
                              <div className="rounded bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                {hint.confidenceReason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {focusedImprovementHints.length === 0 &&
                analysisSummary.reconstructedPoints.length > 0 &&
                analysisSummary.reconstructedPoints.length < 8 && (
                  <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                    十分な記録から改善ヒントを生成できませんでした。ポイント記録が増えると、確認候補を出しやすくなります。
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisSummary.teamGuideCards[focusTeam].cards.map(
                  (card: AnalysisGuideCard) => {
                    const badge = getReliabilityBadge(card.reliability);

                    return (
                      <div
                        key={card.id}
                        className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-semibold leading-snug text-gray-800 dark:text-gray-100">
                            {card.title}
                          </h3>
                          {badge && (
                            <span
                              className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>

                        <div className="mb-2">
                          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {card.primaryValue}
                          </div>
                          {card.secondaryValue && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {card.secondaryValue}
                            </p>
                          )}
                        </div>

                        <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                          {card.summary}
                        </p>

                        <details className="group mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
                          <summary className="cursor-pointer list-none text-sm font-medium text-blue-600 dark:text-blue-400">
                            この数字の見方
                          </summary>

                          <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                            <div>
                              <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                                これは何？
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                                どう見る？
                              </div>
                              <p>{card.howToRead}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                                次に確認
                              </div>
                              <p>{card.nextCheck}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-gray-800 dark:text-gray-100">
                                なぜ見るの？
                              </div>
                              <p>{card.whyItMatters}</p>
                            </div>

                            {card.reliability === 'low' && (
                              <div className="rounded bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                参考値:
                                対象ポイントが少ないため、傾向としてはまだ判断しにくい数字です。
                              </div>
                            )}
                            {card.reliability === 'none' && (
                              <div className="rounded bg-gray-100 px-3 py-2 text-gray-700 dark:bg-gray-700/70 dark:text-gray-200">
                                データ不足:
                                対象ポイントがないため、この指標は表示できません。
                              </div>
                            )}

                            <div className="space-y-2">
                              {card.details.map((detail) => (
                                <div
                                  key={`${card.id}-${detail.label}`}
                                  className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 dark:border-gray-700/60"
                                >
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {formatGuideDetailLabel(detail.label)}
                                  </span>
                                  <span className="text-right font-medium text-gray-800 dark:text-gray-100">
                                    {detail.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {analysisSummary.scoreIntegrity.ok && (
        <details className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <summary className="cursor-pointer list-none text-lg font-semibold text-gray-900 dark:text-gray-100">
            詳細比較
          </summary>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            上部の振り返りポイントの根拠になる、チーム別の比較指標です。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                    指標
                  </th>
                  <th className="py-2 text-center font-medium text-blue-700 dark:text-blue-300">
                    {getShortTeamName('A')}
                  </th>
                  <th className="py-2 text-center font-medium text-green-700 dark:text-green-300">
                    {getShortTeamName('B')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-gray-100 dark:border-gray-700/70"
                  >
                    <td className="py-3 text-gray-700 dark:text-gray-300">
                      {row.label}
                    </td>
                    <td className="py-3 text-center text-gray-800 dark:text-gray-100">
                      {row.a}
                    </td>
                    <td className="py-3 text-center text-gray-800 dark:text-gray-100">
                      {row.b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* 試合統計サマリー */}
      {(() => {
        const matchStats = getMatchStats();

        if (!matchStats) return null;

        return (
          <div className="mb-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              補足統計
            </h3>

            {/* ラリー数分布 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h4 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
                ラリー数分布
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(matchStats.rallyDistribution).map(
                  ([range, count]) => (
                    <div
                      key={range}
                      className="rounded bg-gray-50 p-2 text-center dark:bg-gray-700/60"
                    >
                      <div className="text-lg font-bold text-gray-700 dark:text-gray-100">
                        {count}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {range}ラリー
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* ラリー詳細統計 */}
              {matchStats.rallyCountsArray.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <h5 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                    ラリー詳細
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-gray-700 dark:text-gray-100">
                        {Array.isArray(matchStats.rallyCountsArray) &&
                        matchStats.rallyCountsArray.length > 0 &&
                        Number.isFinite(
                          Math.max(...matchStats.rallyCountsArray),
                        )
                          ? Math.max(...matchStats.rallyCountsArray)
                          : '-'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        最長
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700 dark:text-gray-100">
                        {Array.isArray(matchStats.rallyCountsArray) &&
                        matchStats.rallyCountsArray.length > 0 &&
                        Number.isFinite(
                          Math.min(...matchStats.rallyCountsArray),
                        )
                          ? Math.min(...matchStats.rallyCountsArray)
                          : '-'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        最短
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700 dark:text-gray-100">
                        {Array.isArray(matchStats.rallyCountsArray) &&
                        matchStats.rallyCountsArray.length > 0 &&
                        Number.isFinite(Number(matchStats.avgRally))
                          ? Number(matchStats.avgRally).toFixed(1)
                          : '-'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        平均
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700 dark:text-gray-100">
                        {Array.isArray(matchStats.rallyCountsArray) &&
                        matchStats.rallyCountsArray.length > 0
                          ? (() => {
                              const sorted = [
                                ...matchStats.rallyCountsArray,
                              ].sort((a, b) => a - b);
                              const mid = Math.floor(sorted.length / 2);
                              let median;
                              if (sorted.length % 2 === 0) {
                                median = (sorted[mid - 1] + sorted[mid]) / 2;
                              } else {
                                median = sorted[mid];
                              }
                              return Number.isFinite(median)
                                ? Number(median).toFixed(1)
                                : '-';
                            })()
                          : '-'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-300">
                        中央値
                      </div>
                    </div>
                  </div>

                  {/* 最長ラリーの詳細情報 */}
                  {matchStats.maxRallyDetails && (
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h6 className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                        最長ラリー詳細
                      </h6>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        第
                        {
                          (
                            matchStats.maxRallyDetails as {
                              gameNumber: number;
                              pointNumber: number;
                            }
                          )?.gameNumber
                        }
                        ゲーム・第
                        {
                          (
                            matchStats.maxRallyDetails as {
                              gameNumber: number;
                              pointNumber: number;
                            }
                          )?.pointNumber
                        }
                        ポイント ({matchStats.maxRally}ラリー)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ゲーム詳細（降順、エキスパンド対応） */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ゲーム詳細
        </h3>
        {gamesDesc.map((game: Game) => {
          const isExpanded = expandedGames.has(game.game_number);
          return (
            <div
              key={game.id}
              className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              {/* ゲームヘッダー（クリック可能） */}
              <button
                onClick={() => toggleGameExpansion(game.game_number)}
                className="flex w-full items-center justify-between rounded-t-lg px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60"
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    第{game.game_number}ゲーム
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {game.points_a} - {game.points_b}
                  </span>
                  {game.winner_team && (
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        game.winner_team === 'A'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}
                    >
                      {getShortTeamName(game.winner_team === 'A' ? 'A' : 'B')}
                    </span>
                  )}
                </div>
                <span className="text-xl text-gray-400 dark:text-gray-500">
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {/* ゲーム詳細（エキスパンド時のみ表示） */}
              {isExpanded && game.points && game.points.length > 0 && (
                <div className="border-t border-gray-200 px-4 pb-4 dark:border-gray-700">
                  <div className="space-y-2 mt-3">
                    {getPointsDesc(game).map((point: Point) => {
                      // スコア計算
                      const pointsBeforeThis =
                        game.points?.filter(
                          (p) => p.point_number < point.point_number,
                        ) || [];
                      const teamAPoints = pointsBeforeThis.filter(
                        (p) => p.winner_team === 'A',
                      ).length;
                      const teamBPoints = pointsBeforeThis.filter(
                        (p) => p.winner_team === 'B',
                      ).length;
                      const finalTeamAPoints =
                        teamAPoints + (point.winner_team === 'A' ? 1 : 0);
                      const finalTeamBPoints =
                        teamBPoints + (point.winner_team === 'B' ? 1 : 0);

                      return (
                        <div key={point.id} className="text-sm">
                          {/* ポイント情報（1行目） */}
                          <div className="mb-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium">
                              <span
                                className={
                                  point.winner_team === 'A' ? 'font-bold' : ''
                                }
                              >
                                {finalTeamAPoints}
                              </span>
                              {' - '}
                              <span
                                className={
                                  point.winner_team === 'B' ? 'font-bold' : ''
                                }
                              >
                                {finalTeamBPoints}
                              </span>
                            </span>
                            <span>{point.rally_count}ラリー</span>
                          </div>

                          {/* ポイント内容（2行目） */}
                          <div className="flex items-center gap-3 pl-4">
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {getResultTypeLabel(point.result_type || '')}
                            </span>
                            {/* 選手情報：ウィナー系はwinner_player、ミス系はloser_playerを表示 */}
                            {(() => {
                              const errorTypes = [
                                'net',
                                'out',
                                'smash_error',
                                'volley_error',
                                'double_fault',
                                'receive_error',
                                'follow_error',
                              ];

                              const isError =
                                point.result_type &&
                                errorTypes.includes(point.result_type);
                              const playerName = isError
                                ? point.loser_player
                                : point.winner_player;

                              return playerName ? (
                                <span className="text-gray-700 dark:text-gray-200">
                                  {playerName}
                                </span>
                              ) : null;
                            })()}
                            <div className="flex gap-2">
                              {point.first_serve_fault && (
                                <span className="rounded bg-orange-50 px-1 text-xs text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                                  1stフォルト
                                </span>
                              )}
                              {point.double_fault && (
                                <span className="rounded bg-red-50 px-1 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
                                  ダブルフォルト
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* ゲーム開始時の0-0表示（最後に表示） */}
                    <div className="text-sm">
                      <div className="mb-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">0 - 0</span>
                        <span>ゲーム開始</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 選手別統計情報 */}
      <details className="mb-6 mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <summary className="cursor-pointer list-none text-xl font-semibold text-gray-900 dark:text-gray-100">
          選手別統計情報
        </summary>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          選手ごとのウィナー、ミス、サーブ、ゲーム別の内訳を確認できます。
        </p>
        <div className="mt-4 space-y-6">
          {(() => {
            const playerStats = getPlayerStats();

            const renderPlayerStats = (
              playerName: string,
              stats: {
                winners: number;
                errors: number;
                points: number;
                winnerBreakdown: {
                  [winnerType: string]: number;
                };
                errorBreakdown: {
                  [errorType: string]: number;
                };
                serves: {
                  total: number;
                  aces: number;
                  doubleFaults: number;
                  firstServeFaults: number;
                  firstServeSuccess: number;
                };
                gameStats: {
                  [gameNumber: number]: {
                    winners: number;
                    errors: number;
                    points: number;
                  };
                };
              },
            ) => (
              <div
                key={playerName}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <h4 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {playerName}
                </h4>

                {/* 全体統計 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="rounded bg-green-50 p-3 text-center dark:bg-green-900/20">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.winners}
                    </div>
                    <div className="text-sm text-green-700">ウィナー</div>
                  </div>
                  <div className="rounded bg-red-50 p-3 text-center dark:bg-red-900/20">
                    <div className="text-2xl font-bold text-red-600">
                      {stats.errors}
                    </div>
                    <div className="text-sm text-red-700">ミス</div>
                  </div>
                  <div className="rounded bg-gray-50 p-3 text-center dark:bg-gray-700/60">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-100">
                      {stats.points}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      関与ポイント
                    </div>
                  </div>
                  <div className="rounded bg-gray-50 p-3 text-center dark:bg-gray-700/60">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-100">
                      {stats.points > 0
                        ? ((stats.winners / stats.points) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      ウィナー率
                    </div>
                  </div>
                </div>

                {/* ウィナーとミスの内訳 */}
                {(Object.keys(stats.winnerBreakdown).length > 0 ||
                  Object.keys(stats.errorBreakdown).length > 0) && (
                  <div className="mb-4">
                    <h5 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                      ウィナーとミスの内訳
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ウィナー内訳 */}
                      {Object.keys(stats.winnerBreakdown).length > 0 && (
                        <div className="rounded bg-green-50 p-3 dark:bg-green-900/20">
                          <h6 className="font-medium text-green-700 text-sm mb-2">
                            ウィナー ({stats.winners}回)
                          </h6>
                          <div className="space-y-1">
                            {Object.entries(stats.winnerBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => (
                                <div
                                  key={type}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-gray-700 dark:text-gray-200">
                                    {getResultTypeLabel(type)}
                                  </span>
                                  <span className="font-medium text-green-700">
                                    {count}回
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ミス内訳 */}
                      {Object.keys(stats.errorBreakdown).length > 0 && (
                        <div className="rounded bg-red-50 p-3 dark:bg-red-900/20">
                          <h6 className="font-medium text-red-700 text-sm mb-2">
                            ミス ({stats.errors}回)
                          </h6>
                          <div className="space-y-1">
                            {Object.entries(stats.errorBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => (
                                <div
                                  key={type}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-gray-700 dark:text-gray-200">
                                    {getResultTypeLabel(type)}
                                  </span>
                                  <span className="font-medium text-red-700">
                                    {count}回
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* サーブ統計 */}
                {stats.serves.total > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-sm mb-3">サーブ統計</h5>

                    {/* サーブ横棒グラフ */}
                    {(() => {
                      const total = stats.serves.total;
                      const aces = stats.serves.aces;
                      const doubleFaults = stats.serves.doubleFaults;
                      const firstServeSuccess = stats.serves.firstServeSuccess;
                      // 2ndサーブ成功 = 総サーブ数 - 1stサーブ成功 - ダブルフォルト
                      const secondServeSuccess =
                        total - firstServeSuccess - doubleFaults;

                      const firstServePercent =
                        (firstServeSuccess / total) * 100;
                      const secondServePercent =
                        (secondServeSuccess / total) * 100;
                      const doubleFaultPercent = (doubleFaults / total) * 100;
                      const acePercent = (aces / total) * 100;

                      return (
                        <div className="rounded border border-gray-200 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                          {/* 横棒グラフ */}
                          <div className="space-y-4">
                            {/* 総サーブ数の棒グラフ */}
                            <div className="relative">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                  総サーブ数
                                </span>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                                  {total}本
                                </span>
                              </div>

                              {/* 積み重ね棒グラフ */}
                              <div className="relative h-4 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                                {/* 1stサーブ成功 */}
                                <div
                                  className="absolute top-0 left-0 h-full bg-green-500"
                                  style={{ width: `${firstServePercent}%` }}
                                ></div>

                                {/* 2ndサーブ成功 */}
                                <div
                                  className="absolute top-0 h-full bg-blue-500"
                                  style={{
                                    left: `${firstServePercent}%`,
                                    width: `${secondServePercent}%`,
                                  }}
                                ></div>

                                {/* ダブルフォルト */}
                                <div
                                  className="absolute top-0 h-full bg-red-500"
                                  style={{
                                    left: `${firstServePercent + secondServePercent}%`,
                                    width: `${doubleFaultPercent}%`,
                                  }}
                                ></div>
                              </div>

                              {/* エースとダブルフォルトのマーカー */}
                              <div className="relative mt-1 h-1">
                                {/* エースマーカー */}
                                {aces > 0 && (
                                  <div
                                    className="absolute top-0 h-1 bg-yellow-400 rounded-sm"
                                    style={{
                                      left: '0%',
                                      width: `${acePercent}%`,
                                      minWidth: '2px',
                                    }}
                                    title={`エース: ${aces}本`}
                                  ></div>
                                )}
                              </div>
                            </div>

                            {/* 詳細数値 */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>
                                  1stサーブ成功: {firstServeSuccess}本 (
                                  {firstServePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-400 border border-yellow-600 rounded-full"></div>
                                <span>
                                  エース: {aces}本 ({acePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>
                                  2ndサーブ成功: {secondServeSuccess}本 (
                                  {secondServePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span>
                                  ダブルフォルト: {doubleFaults}本 (
                                  {doubleFaultPercent.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ゲーム別統計 */}
                {Object.keys(stats.gameStats).length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-sm mb-3">ゲーム別詳細</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs">
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                              ゲーム
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700 dark:text-gray-200">
                              ウィナー
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700 dark:text-gray-200">
                              ミス
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700 dark:text-gray-200">
                              関与
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(stats.gameStats)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([gameNumber, gameStats]) => (
                              <tr key={gameNumber}>
                                <td className="px-2 py-1 font-medium">
                                  第{gameNumber}ゲーム
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.winners}
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.errors}
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.points}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* チームA選手 */}
                {teamAPlayers
                  .filter((player) => playerStats[player])
                  .map((playerName) =>
                    renderPlayerStats(playerName, playerStats[playerName]),
                  )}

                {/* チームB選手 */}
                {teamBPlayers
                  .filter((player) => playerStats[player])
                  .map((playerName) =>
                    renderPlayerStats(playerName, playerStats[playerName]),
                  )}

                {/* 上記のチーム分類にない選手がいる場合 */}
                {Object.keys(playerStats).filter(
                  (player) =>
                    ![...teamAPlayers, ...teamBPlayers].includes(player),
                ).length > 0 && (
                  <div>
                    <h3 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                      その他の選手
                    </h3>
                    <div className="space-y-4">
                      {Object.keys(playerStats)
                        .filter(
                          (player) =>
                            ![...teamAPlayers, ...teamBPlayers].includes(
                              player,
                            ),
                        )
                        .map((playerName) =>
                          renderPlayerStats(
                            playerName,
                            playerStats[playerName],
                          ),
                        )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </details>
    </div>
  );
};

// Cloudflare静的export用: 最新50件のみ静的パス生成
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const matchIds = await getLatestBetaMatchIds();
    const paths = matchIds.map((matchId) => ({
      params: { matchId },
    }));

    return {
      paths,
      fallback: false,
    };
  } catch (error) {
    console.error('getStaticPaths error:', error);
    return {
      paths: [],
      fallback: false,
    };
  }
};

// Cloudflare静的export用: ビルド時に静的プロパティ生成
export const getStaticProps: GetStaticProps<PublicMatchDetailProps> = async ({
  params,
}) => {
  try {
    const matchId = params?.matchId as string;

    if (!matchId) {
      return { notFound: true };
    }

    const match = await getBetaMatchById(matchId);

    if (!match) {
      console.error('Match not found:', matchId);
      return { notFound: true };
    }

    // 大会情報を取得（サーバーサイド用関数を使用）
    let tournamentInfo: TournamentInfo | null = null;
    if (match.tournament_name) {
      try {
        tournamentInfo = await getTournamentInfoSSR(match.tournament_name);
      } catch (error) {
        console.error('Tournament info fetch failed:', error);
        // 大会情報の取得に失敗してもマッチデータは表示する
      }
    }

    return {
      props: {
        match,
        tournamentInfo,
      },
    };
  } catch (error) {
    console.error('getStaticProps error:', error);
    return { notFound: true };
  }
};

export default PublicMatchDetail;
