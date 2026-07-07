import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import PageLayout from '@/components/PageLayout';
import MetaHead from '@/components/MetaHead';
import YouTubeRangePlayer, { type YouTubeRangePlayerHandle } from '@/components/YouTubeRangePlayer';
import { getBetaMatchById, getBetaTeamDisplayName, getLatestBetaMatchIds } from '@/lib/betaMatchesStatic';
import { getGrowthTargetForSide } from '@/lib/growthAnalysis';
import { AnalysisGuideCard, AnalysisReliability, analyzeMatch, ImprovementHint, MatchAnalysisSummary, RateMetric, TeamKey } from '@/lib/matchAnalysis';
import { buildSiteUrl, getPublicMatchDetailPath, getPublicMatchesGrowthPath, getPublicMatchesListPath, isScoreSiteMode } from '@/lib/siteConfig';
import { buildEventOrganizer, buildEventPlace, resolveEventDates, sportsEventBaseFields } from '@/lib/sportsEventJsonLd';
import { generateTournamentUrlFromMatch } from '@/lib/tournamentHelpers';
import { getTournamentInfoSSR, TournamentInfo } from '@/lib/tournamentHelpers.server';
import { buildYouTubeWatchUrlFromVideoId, formatVideoTimestamp } from '@/lib/youtubePlayback';

import { Game, Match, Point } from '../../../../types/database';

interface PublicMatchDetailProps {
  match: Match;
  tournamentInfo: TournamentInfo | null;
}

type ReviewGroup = NonNullable<ImprovementHint['reviewGroups']>[number];
type ReviewPoint = ReviewGroup['points'][number];
type SelectedReviewGroup = {
  hintTitle: string;
  group: ReviewGroup;
};
type FloatingVideoSize = 'sm' | 'md' | 'lg';

const POINT_ERROR_TYPES = ['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error'] as const;

const POINT_WINNER_TYPES = ['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace', 'winner'] as const;

const EXTENDED_POINT_ERROR_TYPES = [...POINT_ERROR_TYPES, 'forced_error', 'unforced_error'] as const;

const FLOATING_VIDEO_SIZE_OPTIONS: {
  label: string;
  value: FloatingVideoSize;
}[] = [
  { label: '小', value: 'sm' },
  { label: '中', value: 'md' },
  { label: '大', value: 'lg' },
];

const FLOATING_VIDEO_LAYOUT: Record<FloatingVideoSize, { containerWidth: string }> = {
  sm: {
    containerWidth: 'md:w-[22rem]',
  },
  md: {
    containerWidth: 'md:w-[30rem]',
  },
  lg: {
    containerWidth: 'md:w-[38rem]',
  },
};

const FLOATING_VIDEO_SPACER_CLASS = 'mb-[28rem] md:mb-[42rem]';
const MOBILE_VIDEO_ASPECT_RATIO = 16 / 9;
const TALL_WIDE_VIDEO_ASPECT_RATIO = 32 / 27;

const normalizePlayerName = (name: string | null | undefined) => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length >= 3) {
      return parts.slice(2).join('-').trim() || trimmed;
    }
  }

  return trimmed;
};

const getTeamPlayerNames = (match: Match, team: TeamKey) => {
  const legacyPlayers =
    team === 'A'
      ? [
          match.team_a_player1_first_name && match.team_a_player1_last_name ? `${match.team_a_player1_last_name} ${match.team_a_player1_first_name}` : null,
          match.team_a_player2_first_name && match.team_a_player2_last_name ? `${match.team_a_player2_last_name} ${match.team_a_player2_first_name}` : null,
        ]
      : [
          match.team_b_player1_first_name && match.team_b_player1_last_name ? `${match.team_b_player1_last_name} ${match.team_b_player1_first_name}` : null,
          match.team_b_player2_first_name && match.team_b_player2_last_name ? `${match.team_b_player2_last_name} ${match.team_b_player2_first_name}` : null,
        ];

  const structuredPlayers = match.teams?.[team]?.players?.map((player) => `${player.last_name} ${player.first_name}`.trim()) ?? [];

  return [...legacyPlayers, ...structuredPlayers]
    .map((player) => normalizePlayerName(player))
    .filter((player, index, self): player is string => Boolean(player) && self.indexOf(player) === index);
};

export const PublicMatchDetailPage = ({ match, tournamentInfo }: PublicMatchDetailProps) => {
  const router = useRouter();
  const youtubePlayerRef = useRef<YouTubeRangePlayerHandle | null>(null);
  const playerSectionRef = useRef<HTMLElement | null>(null);
  const handledQueryRef = useRef(false);

  const getTournamentDisplayName = () => {
    const baseName = tournamentInfo?.meta.name || match.tournament_name || '大会名不明';
    const year = match.tournament_year;

    if (!year) {
      return baseName;
    }

    return `${baseName} ${year}`;
  };

  // マッチ勝者を判定する関数を先に定義
  const getMatchWinner = useCallback(() => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
    const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  }, [match]);

  // エキスパンド状態管理（最新ゲームのみ展開）
  const [expandedGames, setExpandedGames] = useState<Set<number>>(
    new Set(match?.games && match.games.length > 0 ? [Math.max(...match.games.map((g) => g.game_number))] : []),
  );
  const [focusTeam, setFocusTeam] = useState<TeamKey>('A');
  const [selectedReviewGroup, setSelectedReviewGroup] = useState<SelectedReviewGroup | null>(null);
  const [highlightedPointId, setHighlightedPointId] = useState<string | null>(null);
  const [youtubeEmbedBlocked, setYoutubeEmbedBlocked] = useState(match.youtube_embed_allowed === false);
  const [isVideoFloating, setIsVideoFloating] = useState(false);
  const [floatingVideoSize, setFloatingVideoSize] = useState<FloatingVideoSize>('md');
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    const queryTeam = router.query.focusTeam;
    if (queryTeam === 'A' || queryTeam === 'B') {
      setFocusTeam(queryTeam);
    }
  }, [router.isReady, router.query.focusTeam]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener('change', syncViewport);
    };
  }, []);

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
  const analysisSummary = useMemo<MatchAnalysisSummary>(() => analyzeMatch(match), [match]);
  const gamesAsc = useMemo(() => [...(match.games ?? [])].sort((a, b) => a.game_number - b.game_number), [match.games]);
  // データベースのプレイヤー情報から苗字のみのチーム名を生成する関数
  const getShortTeamName = useCallback((team: 'A' | 'B') => getBetaTeamDisplayName(match, team), [match]);

  const getPointAnchorId = (pointId: string) => `point-${pointId}`;
  const youtubeVideoId = match.youtube_video_id ?? null;
  const youtubeWatchUrl = match.youtube_url ?? null;

  const formatTeamName = useCallback(
    (team: string | null) => {
      if (team === 'A' || team === 'B') return getShortTeamName(team);
      return '不明';
    },
    [getShortTeamName],
  );

  const formatScoreTransition = (point: ReviewPoint) => `${point.scoreBefore.A}-${point.scoreBefore.B} → ${point.scoreAfter.A}-${point.scoreAfter.B}`;

  const floatingVideoLayout = FLOATING_VIDEO_LAYOUT[floatingVideoSize];
  const activeVideoAspectRatio = isDesktopViewport ? TALL_WIDE_VIDEO_ASPECT_RATIO : MOBILE_VIDEO_ASPECT_RATIO;

  const getPointPlayerName = (point: Point) => {
    const isErrorPoint = point.result_type ? POINT_ERROR_TYPES.includes(point.result_type as (typeof POINT_ERROR_TYPES)[number]) : false;

    return normalizePlayerName(isErrorPoint ? point.loser_player : point.winner_player);
  };

  const getPointPlayerLabel = (point: Point) => {
    const isErrorPoint = point.result_type ? POINT_ERROR_TYPES.includes(point.result_type as (typeof POINT_ERROR_TYPES)[number]) : false;

    return isErrorPoint ? 'ミス' : '得点者';
  };

  const formatServerLabel = useCallback(
    (point: Point) => {
      if (point.serving_player) {
        return normalizePlayerName(point.serving_player) || point.serving_player;
      }

      return formatTeamName(point.serving_team);
    },
    [formatTeamName],
  );

  const playPointVideo = useCallback(
    (point: { id?: string; video_end_ms?: number | null; video_start_ms?: number | null }) => {
      if (point.video_start_ms === null || point.video_start_ms === undefined) {
        return;
      }

      if (!youtubeVideoId || youtubeEmbedBlocked) {
        const fallbackUrl = youtubeVideoId !== null ? buildYouTubeWatchUrlFromVideoId(youtubeVideoId, point.video_start_ms) : youtubeWatchUrl;
        if (fallbackUrl) {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      if (!isVideoFloating) {
        playerSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
      youtubePlayerRef.current?.playFrom(point.video_start_ms);
    },
    [isVideoFloating, youtubeEmbedBlocked, youtubeVideoId, youtubeWatchUrl],
  );

  const scrollToReviewPoint = (point: ReviewPoint) => {
    setExpandedGames((previous) => {
      const next = new Set(previous);
      next.add(point.gameNumber);
      return next;
    });
    setHighlightedPointId(point.pointId);

    window.setTimeout(() => {
      document.getElementById(getPointAnchorId(point.pointId))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      const rawPoint = gamesAsc.flatMap((game) => game.points ?? []).find((candidate) => candidate.id === point.pointId);
      if (rawPoint) {
        playPointVideo(rawPoint);
      }
    }, 0);

    window.setTimeout(() => {
      setHighlightedPointId((current) => (current === point.pointId ? null : current));
    }, 2600);
  };

  const scrollToPoint = useCallback(
    (
      gameNumber: number,
      pointId: string,
      options?: {
        playVideo?: boolean;
      },
    ) => {
      setExpandedGames((previous) => {
        const next = new Set(previous);
        next.add(gameNumber);
        return next;
      });
      setHighlightedPointId(pointId);

      window.setTimeout(() => {
        document.getElementById(getPointAnchorId(pointId))?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        if (options?.playVideo) {
          const rawPoint = gamesAsc.flatMap((game) => game.points ?? []).find((candidate) => candidate.id === pointId);
          if (rawPoint) {
            playPointVideo(rawPoint);
          }
        }
      }, 0);

      window.setTimeout(() => {
        setHighlightedPointId((current) => (current === pointId ? null : current));
      }, 2600);
    },
    [gamesAsc, playPointVideo],
  );

  useEffect(() => {
    if (!router.isReady || handledQueryRef.current) return;

    const pointIdQuery = router.query.pointId;
    const pointNumberQuery = router.query.point;
    const timeQuery = router.query.t;

    if (typeof pointIdQuery === 'string') {
      const locatedPoint = gamesAsc
        .flatMap((game) =>
          (game.points ?? []).map((point) => ({
            gameNumber: game.game_number,
            point,
          })),
        )
        .find(({ point }) => point.id === pointIdQuery);

      if (locatedPoint) {
        handledQueryRef.current = true;
        scrollToPoint(locatedPoint.gameNumber, locatedPoint.point.id, {
          playVideo: true,
        });
      }
      return;
    }

    if (typeof pointNumberQuery === 'string') {
      const pointNumber = Number(pointNumberQuery);
      if (!Number.isNaN(pointNumber)) {
        const locatedPoint = gamesAsc
          .flatMap((game) =>
            (game.points ?? []).map((point) => ({
              gameNumber: game.game_number,
              point,
            })),
          )
          .find(({ point }) => point.point_number === pointNumber);
        if (locatedPoint) {
          handledQueryRef.current = true;
          scrollToPoint(locatedPoint.gameNumber, locatedPoint.point.id, {
            playVideo: true,
          });
          return;
        }
      }
    }

    if (typeof timeQuery === 'string' && youtubeVideoId && !youtubeEmbedBlocked) {
      const seconds = Number(timeQuery);
      if (!Number.isNaN(seconds)) {
        handledQueryRef.current = true;
        youtubePlayerRef.current?.playRange(seconds * 1000);
      }
    }
  }, [gamesAsc, router.isReady, router.query.point, router.query.pointId, router.query.t, scrollToPoint, youtubeEmbedBlocked, youtubeVideoId]);

  const teamAPlayers = useMemo(() => getTeamPlayerNames(match, 'A'), [match]);
  const teamBPlayers = useMemo(() => getTeamPlayerNames(match, 'B'), [match]);

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      // ウィナー系
      smash_winner: 'スマッシュウィナー',
      volley_winner: 'ボレーウィナー',
      passing_winner: 'ストロークウィナー',
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
        className: 'border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }
    if (reliability === 'none') {
      return {
        label: 'データ不足',
        className: 'border border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-700/70 dark:text-gray-300',
      };
    }
    return null;
  };

  const getHintConfidenceBadge = (confidence: ImprovementHint['confidence']) => {
    if (confidence === 'low') {
      return {
        label: '参考',
        className: 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      };
    }
    if (confidence === 'high') {
      return {
        label: '注目',
        className: 'border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
      };
    }
    return {
      label: '確認',
      className: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    };
  };

  const formatHintMetricValue = (metric: ImprovementHint['sourceMetrics'][number]) => {
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

  const getPointsDesc = useCallback((game: Game) => [...(game.points ?? [])].sort((a, b) => b.point_number - a.point_number), []);

  useEffect(() => {
    if (!analysisSummary.scoreIntegrity.ok) {
      console.error('Match analysis score integrity mismatch:', analysisSummary.scoreIntegrity.mismatches);
    }
  }, [analysisSummary]);

  const resultViewModel = useMemo(() => {
    const teamNames = {
      A: getShortTeamName('A'),
      B: getShortTeamName('B'),
    } satisfies Record<TeamKey, string>;
    const overallWinner =
      gamesAsc.filter((game) => game.winner_team === 'A').length > gamesAsc.filter((game) => game.winner_team === 'B').length
        ? 'A'
        : gamesAsc.filter((game) => game.winner_team === 'B').length > gamesAsc.filter((game) => game.winner_team === 'A').length
          ? 'B'
          : null;
    const reconstructedByGame = new Map(
      gamesAsc.map((game) => [game.game_number, analysisSummary.reconstructedPoints.filter((context) => context.gameNumber === game.game_number)]),
    );

    const createReasonCounts = () =>
      new Map<string, number>([
        ['決定打', 0],
        ['相手ミス', 0],
        ['サービスエース', 0],
        ['相手のダブルフォルト', 0],
        ['その他', 0],
      ]);

    const createConcededReasonCounts = () =>
      new Map<string, number>([
        ['相手の決定打', 0],
        ['自チームミス', 0],
        ['自チームのダブルフォルト', 0],
        ['その他', 0],
      ]);

    const toSortedEntries = (counts: Map<string, number>) =>
      [...counts.entries()]
        .filter(([, count]) => count > 0)
        .sort((left, right) => right[1] - left[1])
        .map(([label, count]) => ({ label, count }));

    const getScoreReasonLabel = (team: TeamKey, point: Point) => {
      const resultType = point.result_type || '';
      if (point.winner_team !== team) return 'その他';
      if (resultType === 'service_ace') return 'サービスエース';
      if (resultType === 'double_fault') return '相手のダブルフォルト';
      if (POINT_WINNER_TYPES.includes(resultType as (typeof POINT_WINNER_TYPES)[number])) {
        return '決定打';
      }
      if (EXTENDED_POINT_ERROR_TYPES.includes(resultType as (typeof EXTENDED_POINT_ERROR_TYPES)[number])) {
        return '相手ミス';
      }
      return 'その他';
    };

    const getConcededReasonLabel = (team: TeamKey, point: Point) => {
      const resultType = point.result_type || '';
      if (!point.winner_team || point.winner_team === team) return 'その他';
      if (resultType === 'double_fault') return '自チームのダブルフォルト';
      if (POINT_WINNER_TYPES.includes(resultType as (typeof POINT_WINNER_TYPES)[number])) {
        return '相手の決定打';
      }
      if (EXTENDED_POINT_ERROR_TYPES.includes(resultType as (typeof EXTENDED_POINT_ERROR_TYPES)[number])) {
        return '自チームミス';
      }
      return 'その他';
    };

    const allKnownPlayers = new Map<string, TeamKey | 'unknown'>();
    teamAPlayers.forEach((player) => allKnownPlayers.set(player, 'A'));
    teamBPlayers.forEach((player) => allKnownPlayers.set(player, 'B'));

    const playerStats = new Map<
      string,
      {
        name: string;
        team: TeamKey | 'unknown';
        servePoints: number;
        serveWon: number;
        scoringInvolvements: number;
        concededInvolvements: number;
        doubleFaults: number;
        winnerBreakdown: Map<string, number>;
        errorBreakdown: Map<string, number>;
        gameBreakdown: Map<
          number,
          {
            servePoints: number;
            scoringInvolvements: number;
            concededInvolvements: number;
          }
        >;
      }
    >();

    const ensurePlayer = (playerName: string | null, teamHint?: TeamKey | 'unknown') => {
      if (!playerName) return null;

      const resolvedTeam = allKnownPlayers.get(playerName) ?? teamHint ?? 'unknown';
      if (!allKnownPlayers.has(playerName)) {
        allKnownPlayers.set(playerName, resolvedTeam);
      }

      if (!playerStats.has(playerName)) {
        playerStats.set(playerName, {
          name: playerName,
          team: resolvedTeam,
          servePoints: 0,
          serveWon: 0,
          scoringInvolvements: 0,
          concededInvolvements: 0,
          doubleFaults: 0,
          winnerBreakdown: new Map(),
          errorBreakdown: new Map(),
          gameBreakdown: new Map(),
        });
      }

      const stat = playerStats.get(playerName)!;
      if (stat.team === 'unknown' && resolvedTeam !== 'unknown') {
        stat.team = resolvedTeam;
      }
      return stat;
    };

    const ensurePlayerGame = (stat: NonNullable<ReturnType<typeof ensurePlayer>>, gameNumber: number) => {
      if (!stat.gameBreakdown.has(gameNumber)) {
        stat.gameBreakdown.set(gameNumber, {
          servePoints: 0,
          scoringInvolvements: 0,
          concededInvolvements: 0,
        });
      }
      return stat.gameBreakdown.get(gameNumber)!;
    };

    const pointBreakdown = {
      A: {
        team: 'A' as TeamKey,
        teamName: teamNames.A,
        scoringReasons: createReasonCounts(),
        concededReasons: createConcededReasonCounts(),
      },
      B: {
        team: 'B' as TeamKey,
        teamName: teamNames.B,
        scoringReasons: createReasonCounts(),
        concededReasons: createConcededReasonCounts(),
      },
    };

    gamesAsc.forEach((game) => {
      (game.points ?? []).forEach((point) => {
        (['A', 'B'] as TeamKey[]).forEach((team) => {
          const scoreReason = getScoreReasonLabel(team, point);
          const concededReason = getConcededReasonLabel(team, point);
          pointBreakdown[team].scoringReasons.set(
            scoreReason,
            (pointBreakdown[team].scoringReasons.get(scoreReason) ?? 0) + (point.winner_team === team ? 1 : 0),
          );
          pointBreakdown[team].concededReasons.set(
            concededReason,
            (pointBreakdown[team].concededReasons.get(concededReason) ?? 0) + (point.winner_team && point.winner_team !== team ? 1 : 0),
          );
        });

        const servingTeam = point.serving_team === 'A' || point.serving_team === 'B' ? point.serving_team : 'unknown';
        const servingPlayer = normalizePlayerName(point.serving_player);
        const servingStat = ensurePlayer(servingPlayer, servingTeam);
        if (servingStat) {
          servingStat.servePoints++;
          ensurePlayerGame(servingStat, game.game_number).servePoints++;
          if (point.winner_team === servingTeam) {
            servingStat.serveWon++;
          }
        }

        const scoringPlayer = normalizePlayerName(point.winner_player) || (point.result_type === 'service_ace' ? servingPlayer : null);
        const concededPlayer = normalizePlayerName(point.loser_player) || (point.result_type === 'double_fault' ? servingPlayer : null);

        const scoringStat = ensurePlayer(scoringPlayer, point.winner_team === 'A' || point.winner_team === 'B' ? point.winner_team : 'unknown');
        if (scoringStat) {
          scoringStat.scoringInvolvements++;
          ensurePlayerGame(scoringStat, game.game_number).scoringInvolvements++;
          const label = point.result_type === 'service_ace' ? 'サービスエース' : getResultTypeLabel(point.result_type || 'winner');
          scoringStat.winnerBreakdown.set(label, (scoringStat.winnerBreakdown.get(label) ?? 0) + 1);
        }

        const concededStat = ensurePlayer(concededPlayer, point.winner_team === 'A' ? 'B' : point.winner_team === 'B' ? 'A' : 'unknown');
        if (concededStat) {
          concededStat.concededInvolvements++;
          ensurePlayerGame(concededStat, game.game_number).concededInvolvements++;
          const label = getResultTypeLabel(point.result_type || 'unforced_error');
          concededStat.errorBreakdown.set(label, (concededStat.errorBreakdown.get(label) ?? 0) + 1);
          if (point.double_fault || point.result_type === 'double_fault') {
            concededStat.doubleFaults++;
          }
        }
      });
    });

    const gameFlow = gamesAsc.map((game) => {
      const contexts = reconstructedByGame.get(game.game_number) ?? [];
      let currentStreakTeam: TeamKey | null = null;
      let currentStreakLength = 0;
      let longestStreakTeam: TeamKey | null = null;
      let longestStreakLength = 0;

      const timeline = contexts.map((context) => {
        const winnerTeam = context.point.winner_team === 'A' || context.point.winner_team === 'B' ? context.point.winner_team : null;

        if (winnerTeam) {
          if (winnerTeam === currentStreakTeam) {
            currentStreakLength += 1;
          } else {
            currentStreakTeam = winnerTeam;
            currentStreakLength = 1;
          }

          if (currentStreakLength > longestStreakLength) {
            longestStreakTeam = winnerTeam;
            longestStreakLength = currentStreakLength;
          }
        }

        const tags = [
          context.isTwoTwoPoint ? '2-2' : null,
          context.isDeucePoint ? 'デュース' : null,
          winnerTeam && context.isGamePointOpportunity[winnerTeam] ? 'ゲームポイント' : null,
          currentStreakLength >= 2 && winnerTeam ? `${teamNames[winnerTeam]}${currentStreakLength}連続` : null,
        ].filter((tag): tag is string => Boolean(tag));

        return {
          pointId: context.point.id,
          pointNumber: context.pointNumber,
          scoreLabel: `${context.scoreAfter.A}-${context.scoreAfter.B}`,
          winnerTeam,
          winnerTeamLabel: winnerTeam ? teamNames[winnerTeam] : '不明',
          serverLabel: formatServerLabel(context.point),
          rallyLabel: context.point.rally_count !== null ? `${context.point.rally_count}本` : '未記録',
          resultLabel: getResultTypeLabel(context.point.result_type || ''),
          playerLabel: getPointPlayerName(context.point),
          tags,
        };
      });

      const keyMomentLabels = new Set<string>();
      contexts.forEach((context) => {
        if (context.isTwoTwoPoint) keyMomentLabels.add('2-2の勝負どころあり');
        if (context.isDeucePoint) keyMomentLabels.add('デュースあり');
      });
      if (longestStreakTeam && longestStreakLength >= 2) {
        keyMomentLabels.add(`${teamNames[longestStreakTeam]}が${longestStreakLength}連続得点`);
      }

      return {
        gameNumber: game.game_number,
        winnerTeam: game.winner_team === 'A' || game.winner_team === 'B' ? (game.winner_team as TeamKey) : null,
        finalScore: `${game.points_a}-${game.points_b}`,
        pointCount: timeline.length,
        keyMoments: [...keyMomentLabels],
        longestStreak:
          longestStreakTeam && longestStreakLength > 0
            ? {
                team: longestStreakTeam,
                length: longestStreakLength,
              }
            : null,
        timeline,
      };
    });

    const decisiveCandidateMap = new Map<
      string,
      {
        id: string;
        gameNumber: number;
        label: string;
        description: string;
        category: 'deuce' | 'game_point' | 'two_two' | 'streak_stop';
        weight: number;
      }
    >();

    let previousWinnerTeam: TeamKey | null = null;
    let previousStreakLength = 0;

    analysisSummary.reconstructedPoints.forEach((context) => {
      const winnerTeam = context.point.winner_team === 'A' || context.point.winner_team === 'B' ? context.point.winner_team : null;

      if (!winnerTeam || !overallWinner || winnerTeam !== overallWinner) {
        if (winnerTeam) {
          if (winnerTeam === previousWinnerTeam) {
            previousStreakLength += 1;
          } else {
            previousWinnerTeam = winnerTeam;
            previousStreakLength = 1;
          }
        }
        return;
      }

      const resultLabel = getResultTypeLabel(context.point.result_type || '');
      const isErrorPoint = context.point.result_type
        ? EXTENDED_POINT_ERROR_TYPES.includes(context.point.result_type as (typeof EXTENDED_POINT_ERROR_TYPES)[number])
        : false;
      const loserTeam = winnerTeam === 'A' ? 'B' : winnerTeam === 'B' ? 'A' : null;
      const baseDescription =
        isErrorPoint && loserTeam
          ? `${context.scoreBefore.A}-${context.scoreBefore.B}から${teamNames[loserTeam]}が${resultLabel}で失点`
          : `${context.scoreBefore.A}-${context.scoreBefore.B}から${winnerTeam ? teamNames[winnerTeam] : '得点チーム'}が${resultLabel}でポイント`;
      const addCandidate = (category: 'deuce' | 'game_point' | 'two_two' | 'streak_stop', weight: number, descriptionSuffix?: string) => {
        const existing = decisiveCandidateMap.get(context.point.id);
        const description = descriptionSuffix ? `${baseDescription}。${descriptionSuffix}` : baseDescription;

        if (!existing || weight > existing.weight) {
          decisiveCandidateMap.set(context.point.id, {
            id: context.point.id,
            gameNumber: context.gameNumber,
            category,
            weight,
            label: `第${context.gameNumber}ゲーム`,
            description,
          });
        }
      };

      if (context.isDeucePoint) {
        addCandidate('deuce', 5, 'デュースの場面');
      }

      const hasGamePointOpportunity = context.isGamePointOpportunity[winnerTeam];
      if (hasGamePointOpportunity && !context.isGameWinningPoint) {
        addCandidate('game_point', 4, 'ゲームポイントの場面');
      }

      if (context.isTwoTwoPoint) {
        addCandidate('two_two', 3, '2-2の勝負どころ');
      }

      if (winnerTeam && previousWinnerTeam && winnerTeam !== previousWinnerTeam && previousStreakLength >= 3) {
        addCandidate('streak_stop', 4, `${teamNames[previousWinnerTeam]}の${previousStreakLength}連続ポイントを止めた場面`);
      }

      if (winnerTeam) {
        if (winnerTeam === previousWinnerTeam) {
          previousStreakLength += 1;
        } else {
          previousWinnerTeam = winnerTeam;
          previousStreakLength = 1;
        }
      }
    });

    const categoryOrder = ['deuce', 'game_point', 'two_two', 'streak_stop'] as const;

    const selectedGameCounts = new Map<number, number>();
    const decisiveMoments = categoryOrder
      .flatMap((category) => {
        const limit = category === 'deuce' ? 2 : 1;
        const candidates = [...decisiveCandidateMap.values()].filter((candidate) => candidate.category === category);
        const picked: (typeof candidates)[number][] = [];

        while (picked.length < limit && candidates.length > 0) {
          candidates.sort((left, right) => {
            if (right.weight !== left.weight) {
              return right.weight - left.weight;
            }

            const leftSelectedCount = selectedGameCounts.get(left.gameNumber) ?? 0;
            const rightSelectedCount = selectedGameCounts.get(right.gameNumber) ?? 0;
            if (leftSelectedCount !== rightSelectedCount) {
              return leftSelectedCount - rightSelectedCount;
            }

            if (left.gameNumber !== right.gameNumber) {
              return left.gameNumber - right.gameNumber;
            }

            return left.label.localeCompare(right.label, 'ja');
          });

          const next = candidates.shift();
          if (!next) break;

          picked.push(next);
          selectedGameCounts.set(next.gameNumber, (selectedGameCounts.get(next.gameNumber) ?? 0) + 1);
        }

        return picked;
      })
      .slice(0, 4);

    const playerInvolvement = [...playerStats.values()]
      .map((stat) => ({
        ...stat,
        serveWinRate: stat.servePoints > 0 ? (stat.serveWon / stat.servePoints) * 100 : null,
        winnerBreakdown: toSortedEntries(stat.winnerBreakdown),
        errorBreakdown: toSortedEntries(stat.errorBreakdown),
        gameBreakdown: gamesAsc.map((game) => {
          const gameStat = stat.gameBreakdown.get(game.game_number) ?? {
            servePoints: 0,
            scoringInvolvements: 0,
            concededInvolvements: 0,
          };

          return {
            gameNumber: game.game_number,
            ...gameStat,
          };
        }),
      }))
      .sort((left, right) => {
        const teamOrder = { A: 0, B: 1, unknown: 2 };
        const teamDiff = teamOrder[left.team] - teamOrder[right.team];
        if (teamDiff !== 0) return teamDiff;

        const leftKnown = [...teamAPlayers, ...teamBPlayers].includes(left.name) ? 0 : 1;
        const rightKnown = [...teamAPlayers, ...teamBPlayers].includes(right.name) ? 0 : 1;
        if (leftKnown !== rightKnown) return leftKnown - rightKnown;
        return left.name.localeCompare(right.name, 'ja');
      });

    return {
      matchOverview: {
        gamesWon: {
          A: gamesAsc.filter((game) => game.winner_team === 'A').length,
          B: gamesAsc.filter((game) => game.winner_team === 'B').length,
        },
        totalPoints: analysisSummary.reconstructedPoints.length,
        gameScores: gamesAsc.map((game) => ({
          gameNumber: game.game_number,
          score: `${game.points_a}-${game.points_b}`,
          winnerTeam: game.winner_team === 'A' || game.winner_team === 'B' ? (game.winner_team as TeamKey) : null,
        })),
        streaks: {
          A: {
            for: analysisSummary.neutralComparison.A.momentum.maxStreakFor,
            against: analysisSummary.neutralComparison.A.momentum.maxStreakAgainst,
          },
          B: {
            for: analysisSummary.neutralComparison.B.momentum.maxStreakFor,
            against: analysisSummary.neutralComparison.B.momentum.maxStreakAgainst,
          },
        },
        decisiveMoments,
      },
      gameFlow,
      pointBreakdown: (['A', 'B'] as TeamKey[]).map((team) => ({
        team,
        teamName: pointBreakdown[team].teamName,
        scoringReasons: toSortedEntries(pointBreakdown[team].scoringReasons),
        concededReasons: toSortedEntries(pointBreakdown[team].concededReasons),
      })),
      playerInvolvement,
    };
  }, [analysisSummary, formatServerLabel, gamesAsc, getShortTeamName, teamAPlayers, teamBPlayers]);

  if (!match) return <div className="p-6 text-text dark:bg-gray-900">Match not found</div>;

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
  const focusedGrowthTarget = getGrowthTargetForSide(match, focusTeam);
  const comparisonRows = [
    {
      label: '1stサーブ成功率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.service.firstServeSuccessRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.service.firstServeSuccessRate),
    },
    {
      label: '1stサーブ時得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.service.firstServePointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.service.firstServePointWinRate),
    },
    {
      label: '2ndサーブ時得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.service.secondServePointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.service.secondServePointWinRate),
    },
    {
      label: 'ダブルフォルト数',
      a: `${analysisSummary.neutralComparison.A.service.doubleFaultCount}件`,
      b: `${analysisSummary.neutralComparison.B.service.doubleFaultCount}件`,
    },
    {
      label: 'レシーブ時得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.receive.pointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.receive.pointWinRate),
    },
    {
      label: '各ゲーム1ポイント目取得率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.keyMoments.firstPointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.keyMoments.firstPointWinRate),
    },
    {
      label: '2-2局面取得率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.keyMoments.twoTwoPointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.keyMoments.twoTwoPointWinRate),
    },
    {
      label: 'デュースポイント取得率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.keyMoments.deucePointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.keyMoments.deucePointWinRate),
    },
    {
      label: 'ゲームポイント取得率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.keyMoments.gamePointWinRate),
      b: formatRateMetric(analysisSummary.neutralComparison.B.keyMoments.gamePointWinRate),
    },
    {
      label: '1-2本ラリー得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.rally.buckets['1-2']),
      b: formatRateMetric(analysisSummary.neutralComparison.B.rally.buckets['1-2']),
    },
    {
      label: '3-4本ラリー得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.rally.buckets['3-4']),
      b: formatRateMetric(analysisSummary.neutralComparison.B.rally.buckets['3-4']),
    },
    {
      label: '5-8本ラリー得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.rally.buckets['5-8']),
      b: formatRateMetric(analysisSummary.neutralComparison.B.rally.buckets['5-8']),
    },
    {
      label: '9本以上ラリー得点率',
      a: formatRateMetric(analysisSummary.neutralComparison.A.rally.buckets['9+']),
      b: formatRateMetric(analysisSummary.neutralComparison.B.rally.buckets['9+']),
    },
    {
      label: '最大連続得点',
      a: formatCountMetric(analysisSummary.neutralComparison.A.momentum.maxStreakFor, analysisSummary.neutralComparison.A.momentum.maxStreakForSegment),
      b: formatCountMetric(analysisSummary.neutralComparison.B.momentum.maxStreakFor, analysisSummary.neutralComparison.B.momentum.maxStreakForSegment),
    },
    {
      label: '最大連続失点',
      a: formatCountMetric(analysisSummary.neutralComparison.A.momentum.maxStreakAgainst, analysisSummary.neutralComparison.A.momentum.maxStreakAgainstSegment),
      b: formatCountMetric(analysisSummary.neutralComparison.B.momentum.maxStreakAgainst, analysisSummary.neutralComparison.B.momentum.maxStreakAgainstSegment),
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
      <table className="min-w-full table-auto border-collapse border border-border-strong">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/90">
            <th className="w-auto border border-border-strong px-3 py-2 text-left">チーム</th>
            {gamesAsc.map((game) => (
              <th key={game.game_number} className="min-w-12 border border-border-strong px-3 py-2 text-center">
                {game.game_number}
              </th>
            ))}
            <th className="border border-border-strong bg-warning-bg px-3 py-2 text-center font-bold">G</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
            <td className="w-auto whitespace-nowrap border border-border-strong px-3 py-2 font-medium">{getShortTeamName('A')}</td>
            {gamesAsc.map((game) => (
              <td
                key={game.game_number}
                className={`border border-border-strong px-3 py-2 text-center ${game.winner_team === 'A' ? 'bg-green-100 font-bold text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'font-normal dark:text-gray-200'}`}
              >
                {game.points_a}
              </td>
            ))}
            <td
              className={`border border-border-strong bg-warning-bg px-3 py-2 text-center ${matchWinner === 'A' ? 'font-bold dark:text-yellow-100' : 'font-normal dark:text-gray-200'}`}
            >
              {gamesWonA}
            </td>
          </tr>
          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
            <td className="w-auto whitespace-nowrap border border-border-strong px-3 py-2 font-medium">{getShortTeamName('B')}</td>
            {gamesAsc.map((game) => (
              <td
                key={game.game_number}
                className={`border border-border-strong px-3 py-2 text-center ${game.winner_team === 'B' ? 'bg-green-100 font-bold text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'font-normal dark:text-gray-200'}`}
              >
                {game.points_b}
              </td>
            ))}
            <td
              className={`border border-border-strong bg-warning-bg px-3 py-2 text-center ${matchWinner === 'B' ? 'font-bold dark:text-yellow-100' : 'font-normal dark:text-gray-200'}`}
            >
              {gamesWonB}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  // --- SEO（試合ごとに一意化した title / description / 構造化データ） ---
  // 仕様: docs/wiki/public-pages.md「試合詳細ページの SEO 方針」
  const seoTeamA = getShortTeamName('A');
  const seoTeamB = getShortTeamName('B');
  const seoMatchup = `${seoTeamA} vs ${seoTeamB}`;
  const seoTournamentName = getTournamentDisplayName();
  const seoRoundLabel = match.round_name ? ` ${match.round_name}` : '';
  // trailingSlash: true のため canonical も末尾スラッシュ付きの実 URL に揃える。
  const seoCanonicalUrl = buildSiteUrl(`${getPublicMatchDetailPath(match)}/`);
  const seoWinnerName = matchWinner ? getShortTeamName(matchWinner) : null;
  const seoTotalPoints = resultViewModel.matchOverview.totalPoints;
  const seoResultText = seoWinnerName ? `ゲームカウント${gamesWonA}-${gamesWonB}で${seoWinnerName}が勝利。` : `ゲームカウント${gamesWonA}-${gamesWonB}。`;
  const seoTitle = `${seoMatchup}｜${seoTournamentName}${seoRoundLabel} 試合詳細・スコア`;
  const seoDescription = `${seoTournamentName}${seoRoundLabel}、${seoMatchup}の試合詳細。${seoResultText}全${seoTotalPoints}ポイントのスコア記録と、サーブ・レシーブ・ラリーの分析、勝敗を分けた局面を掲載しています。`;
  // 日付はビルド日ではなく実データ（試合日／記録日）由来とする。
  const seoEventDate = match.match_date || match.created_at;
  const seoTournamentUrl = tournamentInfo && fullTournamentUrl ? buildSiteUrl(`${fullTournamentUrl}/`) : null;

  const sportsEventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${seoMatchup}（${seoTournamentName}${seoRoundLabel}）`,
    sport: 'ソフトテニス',
    url: seoCanonicalUrl,
    ...sportsEventBaseFields,
    ...resolveEventDates(seoEventDate, seoEventDate),
    description: seoDescription,
    competitor: [
      { '@type': 'SportsTeam', name: seoTeamA },
      { '@type': 'SportsTeam', name: seoTeamB },
    ],
    // performer: 対戦両チーム（Google「イベント」の performer 推奨項目に対応）
    performer: [
      { '@type': 'SportsTeam', name: seoTeamA },
      { '@type': 'SportsTeam', name: seoTeamB },
    ],
    organizer: buildEventOrganizer(),
    ...(seoTournamentUrl
      ? {
          superEvent: {
            '@type': 'SportsEvent',
            name: seoTournamentName,
            url: seoTournamentUrl,
          },
        }
      : {}),
    location: buildEventPlace(match.court_name),
  };

  // 可視パンくず。JSON-LD の BreadcrumbList と同じ階層・順序に揃える。
  const breadcrumbItems = [
    { label: 'ホーム', href: '/' },
    { label: '試合一覧', href: getPublicMatchesListPath() },
    ...(tournamentInfo && fullTournamentUrl ? [{ label: seoTournamentName, href: fullTournamentUrl }] : []),
    { label: seoMatchup, href: seoCanonicalUrl },
  ];

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: buildSiteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '試合一覧',
        item: buildSiteUrl(`${getPublicMatchesListPath()}/`),
      },
      ...(seoTournamentUrl
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: seoTournamentName,
              item: seoTournamentUrl,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: seoTournamentUrl ? 4 : 3,
        name: seoMatchup,
        item: seoCanonicalUrl,
      },
    ],
  };

  return (
    <>
      <MetaHead title={seoTitle} description={seoDescription} url={seoCanonicalUrl} type="article" />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(sportsEventJsonLd),
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      </Head>
      {/* PageLayout を適用(docs/ui M4・T5)。幅は既存レイアウト(動画フロート)に合わせ 6xl を維持 */}
      <PageLayout maxWidth="6xl">
        {/* ヘッダー */}
        <Breadcrumbs crumbs={breadcrumbItems} />
        <div className="flex justify-between items-center mb-6">
          <Link href={getPublicMatchesListPath()} className="text-link hover:underline">
            ← 試合一覧に戻る
          </Link>
        </div>

        {selectedReviewGroup && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-points-title"
            onClick={() => setSelectedReviewGroup(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-text-muted">{selectedReviewGroup.hintTitle}</p>
                  <h2 id="review-points-title" className="mt-1 text-lg font-semibold text-text">
                    {selectedReviewGroup.group.label}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReviewGroup(null)}
                  className="rounded border border-border px-3 py-1.5 text-sm text-gray-700 hover:bg-bg-subtle dark:text-gray-200"
                >
                  閉じる
                </button>
              </div>

              {selectedReviewGroup.group.points.length === 0 ? (
                <div className="rounded border border-border bg-gray-50 px-4 py-3 text-sm text-text-secondary dark:bg-gray-800">
                  {selectedReviewGroup.group.emptyMessage}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReviewGroup.group.points.map((point) => {
                    const pointDetails = [point.point_detail, point.point_note, point.shot_type, point.shot_course].filter(Boolean);

                    return (
                      <div key={point.pointId} className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/80">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-semibold text-text">
                              第{point.gameNumber}ゲーム #{point.pointNumber}
                            </div>
                            <div className="mt-1 text-sm text-text-secondary">{formatScoreTransition(point)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              scrollToReviewPoint(point);
                              setSelectedReviewGroup(null);
                            }}
                            className="self-start rounded border border-info-border bg-white px-3 py-1.5 text-sm font-medium text-info hover:bg-blue-50 dark:bg-gray-900 dark:hover:bg-blue-950/40"
                          >
                            このポイントへ移動
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm text-text-secondary sm:grid-cols-2">
                          <div>
                            結果: <span className="font-medium text-text">{getResultTypeLabel(point.resultType || '') || '不明'}</span>
                          </div>
                          <div>
                            得点: <span className="font-medium text-text">{formatTeamName(point.winnerTeam)}</span>
                          </div>
                          <div>
                            選手: <span className="font-medium text-text">{point.playerName || '未記録'}</span>
                          </div>
                          <div>
                            サーブ: <span className="font-medium text-text">{point.servingPlayer || '未記録'}</span>
                          </div>
                          <div>
                            ラリー本数: <span className="font-medium text-text">{point.rallyCount ?? '未記録'}</span>
                          </div>
                        </div>

                        {pointDetails.length > 0 && (
                          <div className="mt-3 rounded bg-white px-3 py-2 text-sm text-text-secondary dark:bg-gray-900/60">{pointDetails.join(' / ')}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <section className="mb-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm font-medium text-text-muted">試合結果</p>
                <h1 className="text-2xl font-bold text-text">
                  {getShortTeamName('A')} vs {getShortTeamName('B')}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {tournamentInfo && fullTournamentUrl ? (
                    <Link href={fullTournamentUrl} className="font-medium text-link hover:underline">
                      {getTournamentDisplayName()}
                    </Link>
                  ) : (
                    <span className="font-medium text-text">{getTournamentDisplayName()}</span>
                  )}
                  {match.round_name && <span className="rounded bg-bg-subtle px-2 py-1 text-xs text-gray-700 dark:text-gray-200">{match.round_name}</span>}
                  <span className="text-text-muted">記録日 {recordedDate}</span>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-3 text-center dark:bg-gray-700/50">
                <div className="text-xs font-medium text-text-muted">最終ゲームカウント</div>
                <div className="mt-1 font-mono text-3xl font-bold text-text">
                  {resultViewModel.matchOverview.gamesWon.A} - {resultViewModel.matchOverview.gamesWon.B}
                </div>
              </div>
            </div>

            {matchWinner && (
              <div className="rounded border border-success-border bg-success-bg p-4">
                <p className="text-lg font-semibold text-success">{getShortTeamName(matchWinner)} の勝利</p>
                <p className="mt-1 text-sm text-success/80">
                  総ポイント {resultViewModel.matchOverview.totalPoints}
                  本の記録があります。
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="text-xs font-medium text-text-muted">総ポイント数</div>
                <div className="mt-2 text-2xl font-bold text-text">{resultViewModel.matchOverview.totalPoints}</div>
              </div>
              <div className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="text-xs font-medium text-text-muted">勝敗を分けた局面候補</div>
                <div className="mt-2 text-2xl font-bold text-text">{resultViewModel.matchOverview.decisiveMoments.length}件</div>
              </div>
              <div className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="text-xs font-medium text-text-muted">{getShortTeamName('A')}の最大連続得点</div>
                <div className="mt-2 text-2xl font-bold text-info">{resultViewModel.matchOverview.streaks.A.for}点</div>
              </div>
              <div className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <div className="text-xs font-medium text-text-muted">{getShortTeamName('B')}の最大連続得点</div>
                <div className="mt-2 text-2xl font-bold text-success">{resultViewModel.matchOverview.streaks.B.for}点</div>
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">ゲームスコア</div>
              {renderScoreboard()}
            </div>

            {resultViewModel.matchOverview.decisiveMoments.length > 0 && (
              <div className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-700/40">
                <h2 className="text-sm font-semibold text-text">勝敗を分けた局面候補</h2>
                <div className="mt-3 grid gap-2">
                  {resultViewModel.matchOverview.decisiveMoments.map((moment) => (
                    <button
                      key={moment.id}
                      type="button"
                      onClick={() =>
                        scrollToPoint(moment.gameNumber, moment.id, {
                          playVideo: true,
                        })
                      }
                      className="w-full rounded bg-surface px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-subtle"
                    >
                      <span className="font-medium text-text">{moment.label}</span> {moment.description}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {(youtubeVideoId || youtubeWatchUrl) && (
          <>
            {isVideoFloating && <div className={FLOATING_VIDEO_SPACER_CLASS} />}
            <section
              ref={playerSectionRef}
              className={
                isVideoFloating ? `fixed left-0 right-0 top-2 z-40 px-1 md:left-auto md:right-6 md:top-2 md:px-0 ${floatingVideoLayout.containerWidth}` : 'mb-8'
              }
            >
              <div className={`${isVideoFloating ? 'mx-auto md:mx-0' : 'mx-auto max-w-6xl'}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsVideoFloating((current) => !current)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${isVideoFloating ? 'border-gray-300 bg-surface text-text shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700' : 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400'}`}
                      aria-pressed={isVideoFloating}
                    >
                      {!isVideoFloating && <span className="h-2.5 w-2.5 rounded-full bg-white/90 ring-4 ring-white/20" />}
                      {isVideoFloating ? '元の位置に戻す' : '動画を固定表示'}
                    </button>
                    {!isVideoFloating && <span className="text-xs font-medium text-info">スクロールしながら動画を見返せます</span>}
                    {isVideoFloating && (
                      <div className="hidden items-center gap-1 rounded-full bg-bg-subtle p-1 md:flex">
                        {FLOATING_VIDEO_SIZE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFloatingVideoSize(option.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                              floatingVideoSize === option.value
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                                : 'text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {youtubeVideoId && !youtubeEmbedBlocked ? (
                  <div className={`overflow-hidden bg-black ${isVideoFloating ? 'rounded-none md:rounded-lg' : 'rounded-lg'}`}>
                    <YouTubeRangePlayer
                      ref={youtubePlayerRef}
                      videoId={youtubeVideoId}
                      onEmbedBlocked={() => setYoutubeEmbedBlocked(true)}
                      responsive
                      aspectRatio={activeVideoAspectRatio}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="rounded border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
                    この動画はページ内に埋め込めないため、各ポイントの再生操作で YouTube を別タブで開きます。
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <section className="mb-8 rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-text">試合の流れ</h2>
            <p className="mt-1 text-sm text-text-muted">各ゲームの途中経過と、連続得点や重要局面をまとめています。</p>
          </div>

          <div className="space-y-3">
            {resultViewModel.gameFlow.map((game) => {
              const isExpanded = expandedGames.has(game.gameNumber);
              const rawGame = gamesAsc.find((candidate) => candidate.game_number === game.gameNumber);

              return (
                <div key={game.gameNumber} className="rounded-lg border border-border bg-gray-50 dark:bg-gray-800/60">
                  <button
                    type="button"
                    onClick={() => toggleGameExpansion(game.gameNumber)}
                    className="flex w-full items-start justify-between gap-3 rounded-t-lg p-4 text-left hover:bg-gray-100/70 dark:hover:bg-gray-700/40"
                  >
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-text">第{game.gameNumber}ゲーム</div>
                      <div className="mt-1 text-sm text-text-secondary">
                        最終スコア {game.finalScore} / {game.pointCount}ポイント
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {game.winnerTeam && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              game.winnerTeam === 'A'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            }`}
                          >
                            {getShortTeamName(game.winnerTeam)} が取得
                          </span>
                        )}
                        {game.keyMoments.map((label) => (
                          <span
                            key={`${game.gameNumber}-${label}`}
                            className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="pt-1 text-xl text-gray-400 dark:text-gray-500">{isExpanded ? '−' : '+'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4">
                      <div className="mt-3 space-y-2">
                        {(rawGame ? getPointsDesc(rawGame).reverse() : []).map((point: Point) => {
                          const pointsBeforeThis = rawGame?.points?.filter((p) => p.point_number < point.point_number) || [];
                          const teamAPoints = pointsBeforeThis.filter((p) => p.winner_team === 'A').length;
                          const teamBPoints = pointsBeforeThis.filter((p) => p.winner_team === 'B').length;
                          const finalTeamAPoints = teamAPoints + (point.winner_team === 'A' ? 1 : 0);
                          const finalTeamBPoints = teamBPoints + (point.winner_team === 'B' ? 1 : 0);

                          const pointContext = game.timeline.find((candidate) => candidate.pointId === point.id);

                          return (
                            <div
                              key={point.id}
                              id={getPointAnchorId(point.id)}
                              className={`rounded-lg border border-border px-3 py-3 text-sm transition-colors ${highlightedPointId === point.id ? 'bg-blue-100 ring-2 ring-blue-300 dark:bg-blue-900/40 dark:ring-blue-700' : 'bg-white dark:bg-gray-900/40'}`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-bg-subtle px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                                  {finalTeamAPoints} - {finalTeamBPoints}
                                </span>
                                <span
                                  className={`rounded px-2 py-1 text-xs font-medium ${
                                    point.winner_team === 'A'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      : point.winner_team === 'B'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                                  }`}
                                >
                                  {formatTeamName(point.winner_team)}
                                  のポイント
                                </span>
                              </div>

                              <div className="mt-2 text-sm text-text-secondary">
                                サーブ {formatServerLabel(point)} / ラリー本数 {point.rally_count !== null ? `${point.rally_count}本` : '未記録'} / 終わり方{' '}
                                {getResultTypeLabel(point.result_type || '')}
                                {getPointPlayerName(point) ? ` / ${getPointPlayerLabel(point)} ${getPointPlayerName(point)}` : ''}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {point.first_serve_fault && <span className="rounded bg-warning-bg px-2 py-1 text-xs text-warning">1stフォルト</span>}
                                {point.double_fault && <span className="rounded bg-danger-bg px-2 py-1 text-xs text-danger">ダブルフォルト</span>}
                                {pointContext?.tags.map((tag) => (
                                  <span key={`${point.id}-${tag}`} className="rounded-full bg-warning-bg px-2.5 py-1 text-xs text-warning">
                                    {tag}
                                  </span>
                                ))}
                                {point.video_start_ms !== null && point.video_start_ms !== undefined && (
                                  <>
                                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                      動画 {formatVideoTimestamp(point.video_start_ms)}
                                      {point.video_end_ms !== null && point.video_end_ms !== undefined
                                        ? ` - ${formatVideoTimestamp(point.video_end_ms)}`
                                        : ' から'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => playPointVideo(point)}
                                      className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                    >
                                      このポイントを見る
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4">
              <div>
                <h2 className="text-xl font-semibold text-text">振り返りポイント</h2>
                <p className="mt-1 text-sm text-text-muted">記録済みポイントから、次に見返す場面を絞るための要点です。</p>
              </div>
            </div>

            {!analysisSummary.scoreIntegrity.ok && (
              <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger">
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
                <div className="mb-4 rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-700/40">
                  <h3 className="mb-2 font-semibold text-text">分析の見方</h3>
                  <p className="text-sm text-text-secondary">
                    この分析は、試合のポイント記録から見返しやすい手がかりをまとめたものです。数字は評価ではなく、次にどの場面を確認するかを考える入口として使います。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-sm text-text-secondary">注目チーム</span>
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
                  <Link
                    href={getPublicMatchesGrowthPath(focusedGrowthTarget.key)}
                    className="rounded border border-border-strong bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    この対象の成長分析
                  </Link>
                </div>

                {focusedImprovementHints.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-text">この試合から見る改善ヒント</h3>
                      <p className="mt-1 text-sm text-text-muted">1試合分の記録から、次に確認しやすい候補を最大3件に絞っています。</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {focusedImprovementHints.map((hint) => {
                        const confidenceBadge = getHintConfidenceBadge(hint.confidence);
                        const reviewGroupsByLabel = new Map((hint.reviewGroups ?? []).map((group) => [group.label, group]));

                        return (
                          <div key={hint.id} className="rounded-lg border border-info-border bg-info-bg p-5">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <h4 className="font-semibold leading-snug text-text">{hint.title}</h4>
                              <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${confidenceBadge.className}`}>
                                {confidenceBadge.label}
                              </span>
                            </div>

                            <div className="space-y-3 text-sm leading-6 text-text-secondary">
                              <p>{hint.evidence}</p>
                              {hint.evidenceItems && hint.evidenceItems.length > 0 && (
                                <ul className="space-y-1">
                                  {hint.evidenceItems.map((item) => (
                                    <li key={`${hint.id}-${item}`} className="rounded bg-white/70 px-3 py-2 text-text-secondary dark:bg-gray-800/70">
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div>
                                <div className="mb-1 font-medium text-text">読み取り</div>
                                <p>{hint.interpretation}</p>
                              </div>

                              <div>
                                <div className="mb-1 font-medium text-text">次に見ること</div>
                                <p>{hint.nextCheck}</p>
                                {hint.nextCheckItems && hint.nextCheckItems.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {hint.nextCheckItems.map((item) => {
                                      const reviewGroup = reviewGroupsByLabel.get(item);

                                      return (
                                        <li key={`${hint.id}-${item}`}>
                                          {reviewGroup ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSelectedReviewGroup({
                                                  hintTitle: hint.title,
                                                  group: reviewGroup,
                                                })
                                              }
                                              className="flex w-full items-center justify-between gap-2 rounded border border-info-border bg-white/75 px-3 py-2 text-left text-sm text-info hover:border-blue-300 hover:bg-white dark:bg-gray-900/40 dark:hover:border-blue-700"
                                            >
                                              <span>{item}</span>
                                              <span className="shrink-0 rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info">
                                                {reviewGroup.points.length}件
                                              </span>
                                            </button>
                                          ) : (
                                            <span className="block rounded bg-white/50 px-3 py-2 dark:bg-gray-900/30">{item}</span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>

                              {hint.sourceMetrics.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {hint.sourceMetrics.map((metric) => (
                                    <span
                                      key={`${hint.id}-${metric.key}-${metric.label ?? metric.value}`}
                                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary"
                                    >
                                      {metric.label ?? metric.key}: <span className="font-semibold">{formatHintMetricValue(metric)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {hint.confidence === 'low' && <div className="rounded bg-warning-bg px-3 py-2 text-warning">{hint.confidenceReason}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {focusedImprovementHints.length === 0 && analysisSummary.reconstructedPoints.length > 0 && analysisSummary.reconstructedPoints.length < 8 && (
                  <div className="mb-6 rounded-lg border border-border bg-gray-50 p-4 text-sm text-text-secondary dark:bg-gray-700/40">
                    十分な記録から改善ヒントを生成できませんでした。ポイント記録が増えると、確認候補を出しやすくなります。
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisSummary.teamGuideCards[focusTeam].cards.map((card: AnalysisGuideCard) => {
                    const badge = getReliabilityBadge(card.reliability);

                    return (
                      <div key={card.id} className="rounded-lg border border-border bg-white p-5 dark:bg-gray-800/80">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-semibold leading-snug text-text">{card.title}</h3>
                          {badge && <span className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>}
                        </div>

                        <div className="mb-2">
                          <div className="text-3xl font-bold text-text">{card.primaryValue}</div>
                          {card.secondaryValue && <p className="mt-1 text-sm text-text-muted">{card.secondaryValue}</p>}
                        </div>

                        <p className="text-sm leading-6 text-text-secondary">{card.summary}</p>

                        <details className="group mt-4 border-t border-border pt-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-primary">
                            <span>この数字の見方をみる</span>
                            <span className="text-xs text-text-muted group-open:hidden">▼</span>
                            <span className="hidden text-xs text-text-muted group-open:inline">▲</span>
                          </summary>

                          <div className="mt-3 space-y-3 text-sm text-text-secondary">
                            <div>
                              <div className="mb-1 font-medium text-text">これは何？</div>
                              <p>{card.description}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-text">どう見る？</div>
                              <p>{card.howToRead}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-text">次に確認</div>
                              <p>{card.nextCheck}</p>
                            </div>
                            <div>
                              <div className="mb-1 font-medium text-text">なぜ見るの？</div>
                              <p>{card.whyItMatters}</p>
                            </div>

                            {card.reliability === 'low' && (
                              <div className="rounded bg-warning-bg px-3 py-2 text-warning">
                                参考値: 対象ポイントが少ないため、傾向としてはまだ判断しにくい数字です。
                              </div>
                            )}
                            {card.reliability === 'none' && (
                              <div className="rounded bg-gray-100 px-3 py-2 text-gray-700 dark:bg-gray-700/70 dark:text-gray-200">
                                データ不足: 対象ポイントがないため、この指標は表示できません。
                              </div>
                            )}

                            <div className="space-y-2">
                              {card.details.map((detail) => (
                                <div
                                  key={`${card.id}-${detail.label}`}
                                  className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 dark:border-gray-700/60"
                                >
                                  <span className="text-text-muted">{formatGuideDetailLabel(detail.label)}</span>
                                  <span className="text-right font-medium text-text">{detail.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {analysisSummary.scoreIntegrity.ok && (
          <details className="group mb-6 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-text">
              <span>分析の根拠をみる</span>
              <span className="text-sm text-text-muted group-open:hidden">▼</span>
              <span className="hidden text-sm text-text-muted group-open:inline">▲</span>
            </summary>
            <p className="mt-2 text-sm text-text-muted">振り返りポイントの背景にある比較指標です。必要なときだけ開いて確認できます。</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-200">指標</th>
                    <th className="py-2 text-center font-medium text-info">{getShortTeamName('A')}</th>
                    <th className="py-2 text-center font-medium text-success">{getShortTeamName('B')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-gray-100 dark:border-gray-700/70">
                      <td className="py-3 text-text-secondary">{row.label}</td>
                      <td className="py-3 text-center text-text">{row.a}</td>
                      <td className="py-3 text-center text-text">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <section className="mb-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-text">得点・失点の内訳</h2>
            <p className="mt-1 text-sm text-text-muted">点がどう動いたかを、得点と失点につながった記録に分けて見られます。</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {resultViewModel.pointBreakdown.map((teamBreakdown) => (
              <div key={teamBreakdown.team} className="rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <h3 className="text-lg font-semibold text-text">{teamBreakdown.teamName}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-white p-4 dark:bg-gray-900/40">
                    <div className="text-sm font-medium text-text">得点につながった記録</div>
                    <div className="mt-3 space-y-2">
                      {teamBreakdown.scoringReasons.map((entry) => (
                        <div key={`${teamBreakdown.team}-${entry.label}-for`} className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">{entry.label}</span>
                          <span className="font-semibold text-text">{entry.count}件</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4 dark:bg-gray-900/40">
                    <div className="text-sm font-medium text-text">失点につながった記録</div>
                    <div className="mt-3 space-y-2">
                      {teamBreakdown.concededReasons.map((entry) => (
                        <div key={`${teamBreakdown.team}-${entry.label}-against`} className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">{entry.label}</span>
                          <span className="font-semibold text-text">{entry.count}件</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-text">選手別サマリー</h2>
            <p className="mt-1 text-sm text-text-muted">各選手がどの役割で関わったかを、まず要点から確認できます。</p>
          </div>

          <div className="space-y-4">
            {resultViewModel.playerInvolvement.map((player) => (
              <details key={player.name} className="group rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-800/60">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-text">{player.name}</div>
                        <div className="mt-1 text-sm text-text-muted">
                          {player.team === 'A' ? getShortTeamName('A') : player.team === 'B' ? getShortTeamName('B') : '所属未確定'}
                        </div>
                      </div>
                      <div className="text-sm text-text-secondary">
                        サーブ {player.servePoints}本 / サーブ時得点率 {player.serveWinRate !== null ? `${player.serveWinRate.toFixed(1)}%` : '—'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm text-text-secondary dark:bg-gray-900/40">
                      <span>詳細をみる</span>
                      <span className="text-xs text-text-muted group-open:hidden">▼</span>
                      <span className="hidden text-xs text-text-muted group-open:inline">▲</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      <div className="rounded bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
                        <div className="text-xs text-text-muted">サーブ</div>
                        <div className="mt-1 font-semibold text-text">{player.servePoints}本</div>
                      </div>
                      <div className="rounded bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
                        <div className="text-xs text-text-muted">サーブ時得点</div>
                        <div className="mt-1 font-semibold text-text">{player.serveWon}本</div>
                      </div>
                      <div className="rounded bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
                        <div className="text-xs text-text-muted">得点に関わった記録</div>
                        <div className="mt-1 font-semibold text-text">{player.scoringInvolvements}件</div>
                      </div>
                      <div className="rounded bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
                        <div className="text-xs text-text-muted">失点につながった記録</div>
                        <div className="mt-1 font-semibold text-text">{player.concededInvolvements}件</div>
                      </div>
                      <div className="rounded bg-white px-3 py-2 text-sm dark:bg-gray-900/40">
                        <div className="text-xs text-text-muted">ダブルフォルト</div>
                        <div className="mt-1 font-semibold text-text">{player.doubleFaults}件</div>
                      </div>
                    </div>
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-4 dark:bg-gray-900/40">
                    <h3 className="text-sm font-medium text-text">決定打の種類</h3>
                    <div className="mt-3 space-y-2">
                      {player.winnerBreakdown.length > 0 ? (
                        player.winnerBreakdown.map((entry) => (
                          <div key={`${player.name}-winner-${entry.label}`} className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">{entry.label}</span>
                            <span className="font-semibold text-text">{entry.count}件</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-text-muted">この試合では個人名付きの決定打記録はありません。</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-4 dark:bg-gray-900/40">
                    <h3 className="text-sm font-medium text-text">改善のヒントになりそうな記録</h3>
                    <div className="mt-3 space-y-2">
                      {player.errorBreakdown.length > 0 ? (
                        player.errorBreakdown.map((entry) => (
                          <div key={`${player.name}-error-${entry.label}`} className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">{entry.label}</span>
                            <span className="font-semibold text-text">{entry.count}件</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-text-muted">個人名付きの失点記録はありません。</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-white p-4 dark:bg-gray-900/40">
                  <h3 className="text-sm font-medium text-text">ゲーム別の関与</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">ゲーム</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-200">サーブ</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-200">得点</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-200">失点</th>
                        </tr>
                      </thead>
                      <tbody>
                        {player.gameBreakdown.map((entry) => (
                          <tr key={`${player.name}-game-${entry.gameNumber}`} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                            <td className="px-3 py-2 font-medium text-text">{entry.gameNumber}</td>
                            <td className="px-3 py-2 text-center text-text-secondary">
                              <span className={entry.servePoints > 0 ? 'font-semibold' : undefined}>{entry.servePoints}</span>
                            </td>
                            <td className="px-3 py-2 text-center text-text-secondary">
                              <span className={entry.scoringInvolvements > 0 ? 'font-semibold' : undefined}>{entry.scoringInvolvements}</span>
                            </td>
                            <td className="px-3 py-2 text-center text-text-secondary">
                              <span className={entry.concededInvolvements > 0 ? 'font-semibold' : undefined}>{entry.concededInvolvements}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </PageLayout>
    </>
  );
};

// Cloudflare静的export用: 最新50件のみ静的パス生成
export const getPublicMatchDetailStaticPaths: GetStaticPaths = async (context?) => {
  void context;
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
export const getPublicMatchDetailStaticProps: GetStaticProps<PublicMatchDetailProps> = async ({ params }) => {
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

export const getStaticPaths: GetStaticPaths = async () => {
  if (isScoreSiteMode()) {
    return {
      paths: [],
      fallback: false,
    };
  }

  return getPublicMatchDetailStaticPaths({} as never);
};

export const getStaticProps: GetStaticProps<PublicMatchDetailProps> = async (context) => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicMatchDetailStaticProps(context);
};

export default PublicMatchDetailPage;
