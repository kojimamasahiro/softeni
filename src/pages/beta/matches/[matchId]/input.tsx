import Error from 'next/error';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback as reactUseCallback, useEffect, useRef, useState } from 'react';

import { hasLiveMatchApi } from '../../../../../lib/betaMatchesClient';
import { isDebugMode } from '../../../../../lib/env';
import { isScoreSiteMode } from '../../../../../lib/siteConfig';
import { determineInitialServeTeam, getCurrentServingPlayerIndex, getCurrentServingTeam } from '../../../../../lib/serveHelpers';
import { formatMsForInput, formatVideoTimestamp, normalizeYouTubeInput, parseSecondsInputToMs } from '../../../../../lib/youtubePlayback';
import ServeSelection from '../../../../components/ServeSelection';
import YouTubeRangePlayer, { type YouTubeRangePlayerHandle } from '../../../../components/YouTubeRangePlayer';
import { Game, Match, Point } from '../../../../types/database';

// 構造化データから選手名を取得するヘルパー関数
const getPlayerNamesFromMatch = (match: Match, team: 'A' | 'B'): string[] => {
  // 構造化データから取得を試行
  if (match.teams && match.teams[team]) {
    return match.teams[team].players.map((player) => `${player.last_name} ${player.first_name}`);
  }

  // 個別フィールドから取得
  const players: string[] = [];
  const prefix = `team_${team.toLowerCase()}`;

  // プレイヤー1
  const player1LastName = match[`${prefix}_player1_last_name` as keyof Match] as string;
  const player1FirstName = match[`${prefix}_player1_first_name` as keyof Match] as string;

  if (player1LastName && player1FirstName) {
    players.push(`${player1LastName} ${player1FirstName}`);
  }

  // プレイヤー2（ダブルスの場合）
  const player2LastName = match[`${prefix}_player2_last_name` as keyof Match] as string;
  const player2FirstName = match[`${prefix}_player2_first_name` as keyof Match] as string;

  if (player2LastName && player2FirstName) {
    players.push(`${player2LastName} ${player2FirstName}`);
  }

  // フォールバック: 文字列から抽出
  if (players.length === 0) {
    const teamString = team === 'A' ? match.team_a : match.team_b;
    if (teamString) {
      try {
        const withoutEntryNumber = teamString.replace(/^[A-Za-z0-9]+\s+/, '');
        const playerParts = withoutEntryNumber.split(' / ');

        return playerParts
          .map((part) => {
            const playerMatch = part.trim().match(/^([^\(]+)/);
            return playerMatch ? playerMatch[1].trim() : part.trim();
          })
          .filter(Boolean);
      } catch (error) {
        console.warn('Failed to parse team string:', teamString, error);
        return [];
      }
    }
  }

  return players;
};

const getGamesWon = (match: Match) => {
  const games = match.games ?? [];

  return {
    gamesWonA: games.filter((game: Game) => game.winner_team === 'A').length,
    gamesWonB: games.filter((game: Game) => game.winner_team === 'B').length,
  };
};

const isMatchFinishedByGames = (bestOf: number, gamesWonA: number, gamesWonB: number) => {
  const requiredWins = Math.ceil(bestOf / 2);
  return gamesWonA >= requiredWins || gamesWonB >= requiredWins;
};

const MatchInput = () => {
  const scoreSiteMode = isScoreSiteMode();
  const router = useRouter();
  const { matchId } = router.query;
  const canEditMatches = isDebugMode() && hasLiveMatchApi();

  const [match, setMatch] = useState<Match | null>(null);
  const mobileYoutubePlayerRef = useRef<YouTubeRangePlayerHandle | null>(null);
  const desktopYoutubePlayerRef = useRef<YouTubeRangePlayerHandle | null>(null);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsServeSelection, setNeedsServeSelection] = useState(false);
  const [initialServeTeam, setInitialServeTeam] = useState<'A' | 'B' | null>(null);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [matchMetadata, setMatchMetadata] = useState({
    match_date: '',
    court_name: '',
    opponent_level: 'unknown',
    youtube_url: '',
    youtube_video_id: '',
    youtube_embed_allowed: true,
  });
  const [youtubeEmbedBlocked, setYoutubeEmbedBlocked] = useState(false);
  const [pendingVideoResume, setPendingVideoResume] = useState<{
    timeMs: number;
    shouldPlay: boolean;
    targetPlayer: 'mobile' | 'desktop';
  } | null>(null);
  const [pendingEditSeekTimeMs, setPendingEditSeekTimeMs] = useState<number | null>(null);
  const [isXlViewport, setIsXlViewport] = useState(false);
  // 手動サーブ選手選択
  const [manualServingPlayer, setManualServingPlayer] = useState<{
    team: 'A' | 'B';
    playerIndex: number;
  } | null>(null);

  // ポイント入力フォームの状態
  // 関与選手
  const [pointData, setPointData] = useState({
    winner_team: '',
    serving_team: '',
    rally_count: 0,
    first_serve_fault: false,
    double_fault: false,
    result_type: '',
    winner_player: '',
    loser_player: '',
    video_start_ms: null as number | null,
    video_end_ms: null as number | null,
  });

  // 選手の一意識別子を生成（チーム + インデックス + 名前）
  const getPlayerUniqueId = (team: 'A' | 'B', index: number, name: string) => {
    return `${team}-${index}-${name}`;
  };

  // 一意識別子から選手名を抽出
  const getPlayerNameFromId = (uniqueId: string) => {
    const parts = uniqueId.split('-');
    return parts.slice(2).join('-'); // チーム(A/B)とインデックス(0/1)を除いた残り
  };

  // 一意識別子からチームを抽出
  const getTeamFromPlayerId = (uniqueId: string): 'A' | 'B' | null => {
    if (uniqueId.startsWith('A-')) return 'A';
    if (uniqueId.startsWith('B-')) return 'B';
    return null;
  };

  const normalizeTeamValue = (teamValue: string | null | undefined): 'A' | 'B' | undefined => {
    if (teamValue === 'A' || teamValue === 'B') {
      return teamValue;
    }

    return undefined;
  };

  const resolvePlayerSelectionValue = (playerValue: string | null | undefined, preferredTeam?: 'A' | 'B') => {
    if (!playerValue || !match) return '';

    const normalizedValue = playerValue.trim();
    if (!normalizedValue) return '';

    const candidateTeams: ('A' | 'B')[] = preferredTeam ? [preferredTeam, preferredTeam === 'A' ? 'B' : 'A'] : ['A', 'B'];

    for (const team of candidateTeams) {
      const players = getPlayerNamesFromMatch(match, team);
      const matchedIndex = players.findIndex((playerName) => playerName === normalizedValue);

      if (matchedIndex >= 0) {
        return getPlayerUniqueId(team, matchedIndex, players[matchedIndex]);
      }
    }

    const storedTeam = getTeamFromPlayerId(normalizedValue);
    if (storedTeam) {
      const storedName = getPlayerNameFromId(normalizedValue);
      const players = getPlayerNamesFromMatch(match, storedTeam);
      const matchedIndex = players.findIndex((playerName) => playerName === storedName);

      if (matchedIndex >= 0) {
        return getPlayerUniqueId(storedTeam, matchedIndex, players[matchedIndex]);
      }
    }

    return normalizedValue;
  };

  // 関与選手とプレイタイプから勝者チームを自動決定する関数
  const determineWinnerTeam = (playerUniqueId: string, resultType: string): 'A' | 'B' | null => {
    if (!playerUniqueId || !resultType || !match) return null;

    // 一意識別子からチームを取得
    const playerTeam = getTeamFromPlayerId(playerUniqueId);
    if (!playerTeam) return null;

    // ウィナー系の結果タイプ
    const winnerTypes = ['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace'];

    // ミス系の結果タイプ
    const errorTypes = ['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error'];

    if (winnerTypes.includes(resultType)) {
      // ウィナーの場合、その選手のチームが勝者
      return playerTeam;
    } else if (errorTypes.includes(resultType)) {
      // ミスの場合、相手チームが勝者
      return playerTeam === 'A' ? 'B' : 'A';
    }

    return null;
  };

  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();

      if (response.ok) {
        setMatch(data.match);
        setMatchMetadata({
          match_date: data.match.match_date ?? '',
          court_name: data.match.court_name ?? '',
          opponent_level: data.match.opponent_level ?? 'unknown',
          youtube_url: data.match.youtube_url ?? '',
          youtube_video_id: data.match.youtube_video_id ?? '',
          youtube_embed_allowed: data.match.youtube_embed_allowed !== false,
        });
        setYoutubeEmbedBlocked(data.match.youtube_embed_allowed === false);
        const games = data.match.games ?? [];
        const { gamesWonA, gamesWonB } = getGamesWon(data.match);
        const matchFinished = isMatchFinishedByGames(data.match.best_of, gamesWonA, gamesWonB);

        if (games.length === 0) {
          setCurrentGame(null);
          setNeedsServeSelection(false);
        } else {
          // 現在進行中のゲームを見つける
          const activeGame = games.find((game: Game) => !game.winner_team);
          if (activeGame) {
            setCurrentGame(activeGame);
            // サーブ権が設定されていない場合は選択が必要
            setNeedsServeSelection(!activeGame.initial_serve_team);
          } else if (matchFinished) {
            const lastGame = games[games.length - 1];
            setCurrentGame(lastGame);
            setNeedsServeSelection(false);
          } else {
            setCurrentGame(null);
            setNeedsServeSelection(false);
          }
        }

        // 第1ゲームの初期サーブ権を保存
        const firstGame = games.find((game: Game) => game.game_number === 1);
        if (firstGame?.initial_serve_team) {
          setInitialServeTeam(firstGame.initial_serve_team as 'A' | 'B');
        }
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const getActiveYouTubeVideoId = () => {
    if (matchMetadata.youtube_video_id) return matchMetadata.youtube_video_id;
    if (match?.youtube_video_id) return match.youtube_video_id;
    return null;
  };

  const getActiveYoutubePlayerRef = () => {
    const useDesktopPlayer = isPointInputActive && isXlViewport;
    return useDesktopPlayer ? desktopYoutubePlayerRef : mobileYoutubePlayerRef;
  };

  const getActiveYoutubePlayerType = () => {
    return isPointInputActive && isXlViewport ? 'desktop' : 'mobile';
  };

  const getYoutubePlayerRefByType = (playerType: 'mobile' | 'desktop') => {
    return playerType === 'desktop' ? desktopYoutubePlayerRef : mobileYoutubePlayerRef;
  };

  const getVideoStartInput = () => formatMsForInput(pointData.video_start_ms);
  const getVideoEndInput = () => formatMsForInput(pointData.video_end_ms);

  const validatePointVideoRange = (data = pointData) => {
    if (data.video_end_ms !== null && data.video_end_ms !== undefined && (data.video_start_ms === null || data.video_start_ms === undefined)) {
      alert('動画終了時刻を入れる場合は、開始時刻も設定してください。');
      return false;
    }

    if (
      data.video_start_ms !== null &&
      data.video_start_ms !== undefined &&
      data.video_end_ms !== null &&
      data.video_end_ms !== undefined &&
      data.video_start_ms > data.video_end_ms
    ) {
      alert('動画開始時刻は終了時刻以前にしてください。');
      return false;
    }

    return true;
  };

  const captureVideoTime = (target: 'start' | 'end') => {
    const capturedMs = getActiveYoutubePlayerRef().current?.captureCurrentTimeMs();
    if (capturedMs === null || capturedMs === undefined) {
      alert('YouTubeプレイヤーの現在時刻を取得できませんでした。');
      return;
    }

    setPointData((current) => ({
      ...current,
      video_start_ms: target === 'start' ? capturedMs : current.video_start_ms,
      video_end_ms: target === 'end' ? capturedMs : current.video_end_ms,
    }));
  };

  const clearVideoRange = () => {
    setPointData((current) => ({
      ...current,
      video_start_ms: null,
      video_end_ms: null,
    }));
  };

  const resumeVideoPlayback = () => {
    getActiveYoutubePlayerRef().current?.play();
  };

  const pauseVideoPlayback = () => {
    getActiveYoutubePlayerRef().current?.pause();
  };

  const seekVideoByMs = (deltaMs: number) => {
    const currentMs = getActiveYoutubePlayerRef().current?.captureCurrentTimeMs();
    if (currentMs === null || currentMs === undefined) {
      return;
    }

    getActiveYoutubePlayerRef().current?.seekToMs(currentMs + deltaMs);
  };

  const preserveVideoPlaybackPosition = () => {
    const activePlayerRef = getActiveYoutubePlayerRef();
    const timeMs = activePlayerRef.current?.captureCurrentTimeMs();
    if (timeMs === null || timeMs === undefined) {
      return;
    }

    setPendingVideoResume({
      timeMs,
      shouldPlay: activePlayerRef.current?.isPlaying() ?? false,
      targetPlayer: getActiveYoutubePlayerType(),
    });
  };

  const jumpToPointVideo = (point: Point) => {
    const startMs = point.video_start_ms;
    if (startMs === null || startMs === undefined) {
      return;
    }

    if (point.video_end_ms !== null && point.video_end_ms !== undefined) {
      getActiveYoutubePlayerRef().current?.playRange(startMs, point.video_end_ms);
      return;
    }

    getActiveYoutubePlayerRef().current?.seekToMs(startMs);
  };

  const getEditPointSeekTimeMs = (game: Game, point: Point) => {
    const targetPointNumber = Number(point.point_number);
    const previousPoint = [...(game.points ?? [])]
      .sort((left, right) => Number(left.point_number) - Number(right.point_number))
      .find((candidate) => Number(candidate.point_number) === targetPointNumber - 1);

    if (previousPoint?.video_end_ms !== null && previousPoint?.video_end_ms !== undefined) {
      return previousPoint.video_end_ms;
    }

    if (point.video_start_ms !== null && point.video_start_ms !== undefined) {
      return point.video_start_ms;
    }

    return null;
  };

  const restorePendingVideoPlayback = (playerType: 'mobile' | 'desktop') => {
    if (!pendingVideoResume) return;
    if (playerType !== pendingVideoResume.targetPlayer) return;

    const targetPlayerRef = getYoutubePlayerRefByType(playerType);
    targetPlayerRef.current?.seekToMs(pendingVideoResume.timeMs);
    if (pendingVideoResume.shouldPlay) {
      targetPlayerRef.current?.play();
    }
    setPendingVideoResume(null);
  };

  const withAutoCapturedVideoEnd = (data: typeof pointData) => {
    if (data.video_start_ms === null || data.video_start_ms === undefined || data.video_end_ms !== null) {
      return data;
    }

    const capturedMs = getActiveYoutubePlayerRef().current?.captureCurrentTimeMs();
    if (capturedMs === null || capturedMs === undefined) {
      return data;
    }

    return {
      ...data,
      video_end_ms: capturedMs,
    };
  };

  // マッチデータの取得
  useEffect(() => {
    if (matchId && canEditMatches) {
      fetchMatch();
    }
  }, [canEditMatches, matchId, fetchMatch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const updateViewport = () => setIsXlViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);

    return () => {
      mediaQuery.removeEventListener('change', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (pendingEditSeekTimeMs === null) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let attempts = 0;

    const trySeek = () => {
      if (cancelled) return;

      const activePlayerRef = isXlViewport ? desktopYoutubePlayerRef : mobileYoutubePlayerRef;
      if (activePlayerRef.current) {
        activePlayerRef.current.pause();
        activePlayerRef.current.seekToMs(pendingEditSeekTimeMs);
        setPendingVideoResume({
          timeMs: pendingEditSeekTimeMs,
          shouldPlay: false,
          targetPlayer: isXlViewport ? 'desktop' : 'mobile',
        });
        setPendingEditSeekTimeMs(null);
        return;
      }

      attempts += 1;
      if (attempts >= 10) {
        setPendingEditSeekTimeMs(null);
        return;
      }

      timeoutId = window.setTimeout(trySeek, 200);
    };

    trySeek();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pendingEditSeekTimeMs, isXlViewport]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.closest('[contenteditable="true"]'));

      if (isTypingTarget || !getActiveYouTubeVideoId()) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        captureVideoTime('start');
      } else if (event.ctrlKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        captureVideoTime('end');
      } else if (event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        resumeVideoPlayback();
      } else if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        clearVideoRange();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekVideoByMs(-5000);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekVideoByMs(5000);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  if (scoreSiteMode) {
    return <Error statusCode={404} />;
  }

  // ポイント編集を開始する関数
  const startEditPoint = (game: Game, point: Point) => {
    setEditingPoint(point);
    setIsEditMode(true);

    const winnerPlayerValue = resolvePlayerSelectionValue(point.winner_player, normalizeTeamValue(point.winner_team));
    const loserTeam = point.winner_team === 'A' ? 'B' : point.winner_team === 'B' ? 'A' : undefined;
    const loserPlayerValue = resolvePlayerSelectionValue(point.loser_player, loserTeam);

    // 編集するポイントの情報をフォームに設定
    setPointData({
      winner_team: point.winner_team || '',
      serving_team: point.serving_team || '',
      rally_count: point.rally_count || 0,
      first_serve_fault: point.first_serve_fault || false,
      double_fault: point.double_fault || false,
      result_type: point.result_type || '',
      winner_player: winnerPlayerValue,
      loser_player: loserPlayerValue,
      video_start_ms: point.video_start_ms ?? null,
      video_end_ms: point.video_end_ms ?? null,
    });

    const seekTimeMs = getEditPointSeekTimeMs(game, point);
    setPendingEditSeekTimeMs(seekTimeMs);
  };

  // ポイント編集をキャンセルする関数
  const cancelEditPoint = () => {
    setEditingPoint(null);
    setIsEditMode(false);
    setPendingEditSeekTimeMs(null);

    // フォームをリセット
    setPointData({
      winner_team: '',
      serving_team: '',
      rally_count: 0,
      first_serve_fault: false,
      double_fault: false,
      result_type: '',
      winner_player: '',
      loser_player: '',
      video_start_ms: null,
      video_end_ms: null,
    });
  };

  // ポイントを更新する関数
  const updatePoint = async () => {
    if (!editingPoint || !pointData.winner_team || !match) return;
    if (!validatePointVideoRange()) return;

    setSubmitting(true);
    try {
      // 一意識別子から選手名を抽出（新形式の場合）
      const winnerPlayerName = pointData.winner_player.includes('-') ? getPlayerNameFromId(pointData.winner_player) : pointData.winner_player;
      const loserPlayerName = pointData.loser_player.includes('-') ? getPlayerNameFromId(pointData.loser_player) : pointData.loser_player;

      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          point_id: editingPoint.id,
          winner_team: pointData.winner_team,
          serving_team: pointData.serving_team,
          rally_count: pointData.rally_count,
          first_serve_fault: pointData.first_serve_fault,
          double_fault: pointData.double_fault,
          result_type: pointData.result_type,
          winner_player: winnerPlayerName,
          loser_player: loserPlayerName,
          video_start_ms: pointData.video_start_ms,
          video_end_ms: pointData.video_end_ms,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // 編集対象ポイントが属するゲームを特定する。
        // 直前に終了したゲームのポイントを編集する場合など、
        // currentGame（= 新しく開始されたゲーム）とは別のゲームのことがある。
        const targetGame = match.games?.find((game: Game) => game.id === result.updatedGame?.id);

        // 編集によってゲーム勝者が変わると、それ以降の状態
        // （新規ゲーム生成・試合完了など）も変わり得るため、
        // ローカルのマージでは整合性を保てない。
        const winnerChanged = targetGame?.winner_team !== result.updatedGame?.winner_team;
        const isCurrentGame = Boolean(currentGame) && currentGame?.id === result.updatedGame?.id;

        if (result.updatedGame && match.games && targetGame && isCurrentGame && !winnerChanged) {
          // 最適化：現在進行中ゲーム内の編集で勝者が変わらない場合のみローカル更新
          const updatedPoints = targetGame.points?.map((point: Point) => (point.id === editingPoint.id ? result.point : point)) || [];

          const updatedCurrentGame = {
            ...result.updatedGame,
            points: updatedPoints,
          };

          // ゲームリストを更新
          const updatedGames = match.games.map((game: Game) => (game.id === result.updatedGame.id ? updatedCurrentGame : game));

          const updatedMatch = {
            ...match,
            games: updatedGames,
          };

          setMatch(updatedMatch);
          setCurrentGame(updatedCurrentGame);
          cancelEditPoint();
        } else {
          // 別ゲームの編集、または勝者が変化したケースでは
          // サーバーの最新状態を取得して確実に反映する。
          cancelEditPoint();
          await fetchMatch();
        }
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
        alert(`更新に失敗しました: ${errorData.error || 'Unknown error'}`);
        // エラーの場合は従来通りデータを再取得
        await fetchMatch();
      }
    } catch (error) {
      console.error('Failed to update point:', error);
      alert('更新中にエラーが発生しました。');
      // エラーの場合は従来通りデータを再取得
      await fetchMatch();
    } finally {
      setSubmitting(false);
    }
  };

  const submitPoint = async () => {
    if (!currentGame || !pointData.winner_team || !match) return;
    const pointDataToSubmit = withAutoCapturedVideoEnd(pointData);
    if (pointDataToSubmit.video_end_ms !== pointData.video_end_ms && pointDataToSubmit.video_end_ms !== null) {
      setPointData(pointDataToSubmit);
    }
    if (!validatePointVideoRange(pointDataToSubmit)) return;

    setSubmitting(true);
    try {
      const nextPointNumber = (currentGame.points?.length || 0) + 1;

      // ゲームスコアを計算
      const gamesWonA = match.games?.filter((game: Game) => game.winner_team === 'A').length || 0;
      const gamesWonB = match.games?.filter((game: Game) => game.winner_team === 'B').length || 0;

      // 現在のサーブ権を計算
      const currentServingTeam = getCurrentServingTeam(currentGame, nextPointNumber, match.best_of, gamesWonA, gamesWonB);

      // 現在のサーブ選手を取得
      const currentServingPlayer = getCurrentServingPlayer();
      const servingPlayerName = currentServingPlayer?.playerName || '';

      // 一意識別子から選手名を抽出（新形式の場合）
      const winnerPlayerName = pointDataToSubmit.winner_player.includes('-')
        ? getPlayerNameFromId(pointDataToSubmit.winner_player)
        : pointDataToSubmit.winner_player;
      const loserPlayerName = pointDataToSubmit.loser_player.includes('-')
        ? getPlayerNameFromId(pointDataToSubmit.loser_player)
        : pointDataToSubmit.loser_player;

      // 楽観的UI更新：即座にUIを更新
      const optimisticPoint = {
        id: `temp-${Date.now()}`, // 一時的なID
        game_id: currentGame.id,
        point_number: nextPointNumber,
        serving_team: currentServingTeam,
        serving_player: servingPlayerName,
        winner_team: pointDataToSubmit.winner_team,
        rally_count: pointDataToSubmit.rally_count,
        first_serve_fault: pointDataToSubmit.first_serve_fault,
        double_fault: pointDataToSubmit.double_fault,
        result_type: pointDataToSubmit.result_type,
        winner_player: winnerPlayerName,
        loser_player: loserPlayerName,
        video_start_ms: pointDataToSubmit.video_start_ms,
        video_end_ms: pointDataToSubmit.video_end_ms,
        created_at: new Date().toISOString(),
      };

      // UIを即座に更新
      const optimisticCurrentGame = {
        ...currentGame,
        points: [...(currentGame.points || []), optimisticPoint],
        points_a: currentGame.points_a + (pointDataToSubmit.winner_team === 'A' ? 1 : 0),
        points_b: currentGame.points_b + (pointDataToSubmit.winner_team === 'B' ? 1 : 0),
      };

      setCurrentGame(optimisticCurrentGame);

      // フォームを即座にリセット
      setPointData({
        winner_team: '',
        serving_team: '',
        rally_count: 0,
        first_serve_fault: false,
        double_fault: false,
        result_type: '',
        winner_player: '',
        loser_player: '',
        video_start_ms: null,
        video_end_ms: null,
      });

      // デバッグ用ログ
      console.log('Submitting point data:', {
        game_id: currentGame.id,
        point_number: nextPointNumber,
        serving_team: currentServingTeam,
        serving_player: servingPlayerName,
        winner_team: pointDataToSubmit.winner_team,
        rally_count: pointDataToSubmit.rally_count,
        first_serve_fault: pointDataToSubmit.first_serve_fault,
        double_fault: pointDataToSubmit.double_fault,
        result_type: pointDataToSubmit.result_type,
        winner_player: winnerPlayerName,
        loser_player: loserPlayerName,
        video_start_ms: pointDataToSubmit.video_start_ms,
        video_end_ms: pointDataToSubmit.video_end_ms,
      });

      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: currentGame.id,
          point_number: nextPointNumber,
          serving_team: currentServingTeam,
          serving_player: servingPlayerName,
          winner_team: pointDataToSubmit.winner_team,
          rally_count: pointDataToSubmit.rally_count,
          first_serve_fault: pointDataToSubmit.first_serve_fault,
          double_fault: pointDataToSubmit.double_fault,
          result_type: pointDataToSubmit.result_type,
          winner_player: winnerPlayerName,
          loser_player: loserPlayerName,
          video_start_ms: pointDataToSubmit.video_start_ms,
          video_end_ms: pointDataToSubmit.video_end_ms,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // 最適化：レスポンスデータを使ってローカル状態を更新
        if (result.updatedGame && match.games) {
          // 現在のゲームを更新
          const updatedGames = match.games.map((game: Game) => (game.id === result.updatedGame.id ? result.updatedGame : game));

          // ポイントを追加
          const updatedCurrentGame = {
            ...result.updatedGame,
            points: [...(currentGame.points || []), result.point],
          };

          // マッチデータを更新
          const updatedMatch = {
            ...match,
            games: updatedGames.map((game: Game) => (game.id === updatedCurrentGame.id ? updatedCurrentGame : game)),
          };

          setMatch(updatedMatch);
          setCurrentGame(updatedCurrentGame);

          if (result.updatedGame.winner_team) {
            const { gamesWonA, gamesWonB } = getGamesWon(updatedMatch);
            const finished = isMatchFinishedByGames(updatedMatch.best_of, gamesWonA, gamesWonB);

            if (!finished) {
              const nextGameNumber = updatedMatch.games.length + 1;
              preserveVideoPlaybackPosition();
              const nextGameResponse = await fetch(`/api/matches/${matchId}/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  game_number: nextGameNumber,
                }),
              });

              if (nextGameResponse.ok) {
                await fetchMatch();
              } else {
                console.error('Failed to auto start next game');
              }
            }
            if (finished) {
              await markMatchCompleted(updatedMatch);
            }
          }
        }

        // 次のポイントでサーブチームが変わる場合、手動選択をリセット
        const nextServingTeam = getCurrentServingTeam(currentGame, nextPointNumber + 1, match.best_of, gamesWonA, gamesWonB);
        if (manualServingPlayer && manualServingPlayer.team !== nextServingTeam) {
          setManualServingPlayer(null);
        }
      } else {
        // エラーの場合：楽観的更新を元に戻し、データを再取得
        console.error('API error, reverting optimistic update');
        setCurrentGame(currentGame); // 元の状態に戻す
        await fetchMatch();
      }
    } catch (error) {
      console.error('Failed to submit point:', error);
      // エラーの場合：楽観的更新を元に戻し、データを再取得
      setCurrentGame(currentGame); // 元の状態に戻す
      await fetchMatch();
    } finally {
      setSubmitting(false);
    }
  };

  const updateMatchMetadata = async () => {
    if (!match) return;

    setMetadataSaving(true);
    try {
      const response = await fetch(`/api/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: (() => {
          const normalizedYouTube = normalizeYouTubeInput(matchMetadata.youtube_url);

          return JSON.stringify({
            match_date: matchMetadata.match_date || null,
            court_name: matchMetadata.court_name || null,
            opponent_level: matchMetadata.opponent_level || 'unknown',
            youtube_url: normalizedYouTube.watchUrl,
            youtube_video_id: normalizedYouTube.videoId,
            youtube_embed_allowed: youtubeEmbedBlocked ? false : matchMetadata.youtube_embed_allowed,
          });
        })(),
      });

      if (response.ok) {
        const data = await response.json();
        setMatch({ ...match, ...data.match });
        setMatchMetadata((current) => ({
          ...current,
          youtube_url: data.match.youtube_url ?? '',
          youtube_video_id: data.match.youtube_video_id ?? '',
          youtube_embed_allowed: data.match.youtube_embed_allowed !== false,
        }));
        setYoutubeEmbedBlocked(data.match.youtube_embed_allowed === false);
      } else {
        const errorData = await response.json();
        alert(`試合情報の保存に失敗しました: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update match metadata:', error);
      alert('試合情報の保存中にエラーが発生しました。');
    } finally {
      setMetadataSaving(false);
    }
  };

  const markMatchCompleted = async (completedMatch: Match) => {
    if (completedMatch.status === 'completed') return;

    try {
      const response = await fetch(`/api/matches/${completedMatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMatch({ ...completedMatch, ...data.match });
      }
    } catch (error) {
      console.error('Failed to mark match completed:', error);
    }
  };

  // 試合終了判定
  const isMatchFinished = (match: Match): boolean => {
    if (!match.games || match.games.length === 0) return false;

    const { gamesWonA, gamesWonB } = getGamesWon(match);
    return isMatchFinishedByGames(match.best_of, gamesWonA, gamesWonB);
  };

  // 試合の勝者を取得
  const getMatchWinner = (match: Match): 'A' | 'B' | null => {
    if (!isMatchFinished(match)) return null;

    const { gamesWonA, gamesWonB } = getGamesWon(match);
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  // サーブ権を決定してゲームを開始
  const handleServeTeamSelected = async (selectedTeam: 'A' | 'B', playerIndex?: number) => {
    if (!match) return;

    const gameToUpdate = currentGame;
    if (!gameToUpdate) return;
    preserveVideoPlaybackPosition();

    try {
      // 第1ゲームの場合は選択されたチーム、それ以外は自動計算
      let initialServe: 'A' | 'B';
      let initialPlayerIndex = playerIndex ?? 0;

      if (gameToUpdate.game_number === 1) {
        initialServe = selectedTeam;
        setInitialServeTeam(selectedTeam);
      } else {
        // 前のゲームの初期サーブ権から計算
        if (!initialServeTeam) {
          console.error('Initial serve team not set');
          return;
        }
        initialServe = determineInitialServeTeam(gameToUpdate.game_number, initialServeTeam);
        // 他のゲームでは、デフォルトで0番目の選手から開始（ユーザーが選択した場合はそれを使用）
        initialPlayerIndex = playerIndex ?? 0;
      }

      // ゲームのサーブ権と初期サーブ選手を更新
      const response = await fetch(`/api/matches/${matchId}/games/${gameToUpdate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_serve_team: initialServe,
          initial_serve_player_index: initialPlayerIndex,
        }),
      });

      if (response.ok) {
        await fetchMatch();
        setNeedsServeSelection(false);
        // 新しいゲーム開始時に手動サーブ選択をリセット
        setManualServingPlayer(null);
      }
    } catch (error) {
      console.error('Failed to set serve team:', error);
    }
  };

  const startNewGame = async () => {
    if (!match) return;

    // 試合が終了している場合は新しいゲームを開始しない
    if (isMatchFinished(match)) {
      console.log('Match is already finished');
      return;
    }

    const nextGameNumber = (match.games?.length || 0) + 1;
    preserveVideoPlaybackPosition();

    try {
      const response = await fetch(`/api/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_number: nextGameNumber,
        }),
      });

      if (response.ok) {
        await fetchMatch();
      }
    } catch (error) {
      console.error('Failed to start new game:', error);
    }
  };

  const startFirstGame = async () => {
    if (!match) return;
    preserveVideoPlaybackPosition();

    try {
      const response = await fetch(`/api/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_number: 1,
        }),
      });

      if (response.ok) {
        await fetchMatch();
      } else {
        const errorData = await response.json();
        alert(`第1ゲームの開始に失敗しました: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to start first game:', error);
      alert('第1ゲームの開始中にエラーが発生しました。');
    }
  };

  // 現在のサーブ権を取得
  const getCurrentServe = (): 'A' | 'B' | null => {
    if (!currentGame || !currentGame.initial_serve_team || !match) return null;

    const nextPointNumber = (currentGame.points?.length || 0) + 1;
    const gamesWonA = match.games?.filter((game: Game) => game.winner_team === 'A').length || 0;
    const gamesWonB = match.games?.filter((game: Game) => game.winner_team === 'B').length || 0;

    return getCurrentServingTeam(currentGame, nextPointNumber, match.best_of, gamesWonA, gamesWonB);
  };

  // 現在のサーブ選手を取得
  const getCurrentServingPlayer = (): {
    team: 'A' | 'B';
    playerName: string;
    playerIndex: number;
  } | null => {
    if (!currentGame || !currentGame.initial_serve_team || !match) return null;

    const nextPointNumber = (currentGame.points?.length || 0) + 1;
    const gamesWonA = match.games?.filter((game: Game) => game.winner_team === 'A').length || 0;
    const gamesWonB = match.games?.filter((game: Game) => game.winner_team === 'B').length || 0;

    const servingTeam = getCurrentServingTeam(currentGame, nextPointNumber, match.best_of, gamesWonA, gamesWonB);

    // 手動選択が有効で、正しいチームが選択されている場合
    if (manualServingPlayer && manualServingPlayer.team === servingTeam) {
      const teamPlayers = getPlayerNamesFromMatch(match, servingTeam);
      const playerName = teamPlayers[manualServingPlayer.playerIndex] || teamPlayers[0] || '';
      return {
        team: servingTeam,
        playerName,
        playerIndex: manualServingPlayer.playerIndex,
      };
    }

    // 自動計算
    const teamPlayers = getPlayerNamesFromMatch(match, servingTeam);
    const playerIndex = getCurrentServingPlayerIndex(
      currentGame,
      nextPointNumber,
      match.best_of,
      gamesWonA,
      gamesWonB,
      teamPlayers,
      currentGame.initial_serve_player_index ?? undefined,
    );

    const playerName = teamPlayers[playerIndex] || teamPlayers[0] || '';

    return {
      team: servingTeam,
      playerName,
      playerIndex,
    };
  };

  // 特定のポイントでのサーブ選手を取得
  const getServingPlayerForPoint = (
    game: Game,
    pointNumber: number,
  ): {
    team: 'A' | 'B';
    playerName: string;
    playerIndex: number;
  } | null => {
    if (!game.initial_serve_team || !match) return null;

    const gamesWonA = match.games?.filter((g: Game) => g.winner_team === 'A').length || 0;
    const gamesWonB = match.games?.filter((g: Game) => g.winner_team === 'B').length || 0;

    const servingTeam = getCurrentServingTeam(game, pointNumber, match.best_of, gamesWonA, gamesWonB);

    const teamPlayers = getPlayerNamesFromMatch(match, servingTeam);
    const playerIndex = getCurrentServingPlayerIndex(
      game,
      pointNumber,
      match.best_of,
      gamesWonA,
      gamesWonB,
      teamPlayers,
      game.initial_serve_player_index ?? undefined,
    );

    const playerName = teamPlayers[playerIndex] || teamPlayers[0] || '';

    return {
      team: servingTeam,
      playerName,
      playerIndex,
    };
  };

  // 開発環境でない場合はアクセス拒否
  if (!canEditMatches) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">編集不可</strong>
          <span className="block sm:inline ml-2">このページは開発サーバーでのみ利用できます。静的公開環境では閲覧用の詳細ページをご利用ください。</span>
        </div>
      </div>
    );
  }

  if (loading) return <div>Loading...</div>;
  if (!match) return <div>Match not found</div>;

  const currentScore = currentGame ? `${currentGame.points_a} - ${currentGame.points_b}` : '';
  const gameWon = currentGame?.winner_team;
  const matchFinished = isMatchFinished(match);
  const matchWinner = getMatchWinner(match);
  const isPointInputActive = Boolean(currentGame && ((!gameWon && !matchFinished && !needsServeSelection) || isEditMode));
  const activeYouTubeVideoId = getActiveYouTubeVideoId();
  const showDesktopVideoLayout = Boolean(activeYouTubeVideoId && isXlViewport && (isPointInputActive || needsServeSelection));
  const sortedGames = [...(match.games ?? [])].sort((a, b) => {
    if (currentGame) {
      if (a.id === currentGame.id) return -1;
      if (b.id === currentGame.id) return 1;
    }

    return a.game_number - b.game_number;
  });
  const gameHistorySection = (
    <div className={`bg-white rounded-lg shadow-md p-6 ${isPointInputActive ? 'mt-4 xl:col-start-2 xl:mt-0' : ''}`}>
      <h3 className="text-lg font-semibold mb-4">ゲーム履歴</h3>
      <div className="space-y-4">
        {sortedGames.map((game: Game) => (
          <div key={game.id} className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">第{game.game_number}ゲーム</h4>
                {currentGame?.id === game.id && <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">現在のゲーム</span>}
              </div>
              <div className="text-lg font-bold">
                {game.points_a} - {game.points_b}
                {game.winner_team && <span className="ml-2 text-green-600">(チーム{game.winner_team}勝利)</span>}
              </div>
            </div>

            {game.points && game.points.length > 0 ? (
              <div className="mt-2">
                <h5 className="text-sm font-medium mb-2">ポイント詳細:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {game.points
                    .sort((a, b) => a.point_number - b.point_number)
                    .map((point: Point) => (
                      <div key={point.id} className="bg-gray-50 rounded p-2">
                        <div className="flex justify-between items-center">
                          <span>#{point.point_number}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">チーム{point.winner_team}</span>
                            {canEditMatches && (
                              <button
                                onClick={() => startEditPoint(game, point)}
                                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                title="このポイントを編集"
                              >
                                編集
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          🏓{' '}
                          {(() => {
                            const servingPlayer = getServingPlayerForPoint(game, point.point_number);
                            return servingPlayer ? `${servingPlayer.playerName} (チーム${point.serving_team})` : `チーム${point.serving_team}のサーブ`;
                          })()}
                        </div>
                        <div className="text-xs text-gray-600">
                          {point.result_type} ({point.rally_count}ラリー)
                          {point.winner_player && (
                            <span> - {point.winner_player.includes('-') ? getPlayerNameFromId(point.winner_player) : point.winner_player}</span>
                          )}
                        </div>
                        {(point.video_start_ms !== null || point.video_end_ms !== null) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">
                              動画:
                              {point.video_start_ms !== null ? ` ${formatVideoTimestamp(point.video_start_ms, true)}` : ' -'}
                              {point.video_end_ms !== null && ` - ${formatVideoTimestamp(point.video_end_ms, true)}`}
                            </span>
                            {activeYouTubeVideoId && !youtubeEmbedBlocked && (
                              <button
                                type="button"
                                onClick={() => jumpToPointVideo(point)}
                                className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600"
                              >
                                {point.video_end_ms !== null ? 'この範囲を再生' : 'この時刻へ移動'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : currentGame?.id === game.id ? (
              <div className="mt-2 rounded bg-blue-50 px-3 py-4 text-center text-sm text-blue-700">現在のゲームはまだポイントがありません</div>
            ) : null}
          </div>
        ))}

        {sortedGames.length === 0 && <div className="text-center text-gray-500 py-4">まだゲームが開始されていません</div>}
      </div>
    </div>
  );

  // ゲームスコア表示用
  const getGameScores = () => {
    if (!match.games) return '';

    const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
    const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;

    return `${gamesWonA} - ${gamesWonB}`;
  };

  return (
    <div className={`mx-auto p-6 ${isPointInputActive ? 'max-w-8xl' : 'max-w-4xl'}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/beta/matches/${match.id}`} className="text-blue-600 hover:underline">
          ← マッチ詳細に戻る
        </Link>
        <Link href={`/beta/matches/${match.id}/video-review`} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
          動画レビューへ
        </Link>
      </div>

      {/* マッチ情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {match.team_a} vs {match.team_b}
        </h1>
        <p className="text-gray-600 mb-2">大会: {match.tournament_name}</p>
        <p className="text-gray-600">形式: {match.best_of} ゲームマッチ</p>

        <div className="mt-4 grid gap-3 rounded border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="block text-xs text-gray-600 mb-1">試合日</label>
            <input
              type="date"
              value={matchMetadata.match_date}
              onChange={(e) =>
                setMatchMetadata({
                  ...matchMetadata,
                  match_date: e.target.value,
                })
              }
              className="w-full rounded border p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">コート</label>
            <input
              type="text"
              value={matchMetadata.court_name}
              onChange={(e) =>
                setMatchMetadata({
                  ...matchMetadata,
                  court_name: e.target.value,
                })
              }
              className="w-full rounded border p-2 text-sm"
              placeholder="例: 第1コート"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">YouTube URL</label>
            <input
              type="url"
              value={matchMetadata.youtube_url}
              onChange={(e) => {
                const normalized = normalizeYouTubeInput(e.target.value);
                setYoutubeEmbedBlocked(false);
                setMatchMetadata({
                  ...matchMetadata,
                  youtube_url: e.target.value,
                  youtube_video_id: normalized.videoId || '',
                  youtube_embed_allowed: true,
                });
              }}
              className="w-full rounded border p-2 text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {matchMetadata.youtube_video_id && <p className="mt-1 text-xs text-gray-500">動画ID: {matchMetadata.youtube_video_id}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">相手レベル</label>
            <select
              value={matchMetadata.opponent_level}
              onChange={(e) =>
                setMatchMetadata({
                  ...matchMetadata,
                  opponent_level: e.target.value,
                })
              }
              className="w-full rounded border p-2 text-sm"
            >
              <option value="unknown">不明</option>
              <option value="stronger">格上</option>
              <option value="same">同格</option>
              <option value="weaker">格下</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={updateMatchMetadata}
              disabled={metadataSaving}
              className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:bg-gray-300"
            >
              {metadataSaving ? '保存中...' : '試合情報を保存'}
            </button>
          </div>
        </div>

        {/* チーム詳細情報 */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded">
            <h3 className="font-semibold text-blue-800 mb-2">チーム A</h3>
            <div className="text-sm break-all">{match.team_a}</div>
          </div>
          <div className="p-3 bg-red-50 rounded">
            <h3 className="font-semibold text-red-800 mb-2">チーム B</h3>
            <div className="text-sm break-all">{match.team_b}</div>
          </div>
        </div>

        {activeYouTubeVideoId && (
          <div className={`mt-4 rounded border border-gray-200 bg-gray-50 p-4 ${showDesktopVideoLayout ? 'xl:hidden' : ''}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">YouTube ポイント記録補助</h3>
                <p className="text-xs text-gray-500">`Ctrl + S` で開始、`Ctrl + E` で終了、`Ctrl + D` で再生、`Ctrl + F` でクリア、`← / →` で 5 秒移動</p>
              </div>
              {youtubeEmbedBlocked && matchMetadata.youtube_url && (
                <a href={matchMetadata.youtube_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  YouTubeで開く
                </a>
              )}
            </div>

            {youtubeEmbedBlocked ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                この動画は埋め込み再生できなかったため、外部 YouTube で確認してください。
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg bg-black">
                  <YouTubeRangePlayer
                    ref={mobileYoutubePlayerRef}
                    videoId={activeYouTubeVideoId}
                    onReady={() => restorePendingVideoPlayback('mobile')}
                    onEmbedBlocked={() => {
                      setYoutubeEmbedBlocked(true);
                      setMatchMetadata((current) => ({
                        ...current,
                        youtube_embed_allowed: false,
                      }));
                    }}
                    className="aspect-video w-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={resumeVideoPlayback} className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
                    続きから再生
                  </button>
                  <button type="button" onClick={pauseVideoPlayback} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-white">
                    一時停止
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 試合終了表示 */}
      {matchFinished && matchWinner && (
        <div className="bg-green-100 border border-green-400 rounded-lg p-6 mb-6 text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-2">🏆 試合終了！</h2>
          <p className="text-xl text-green-700">{matchWinner === 'A' ? match.team_a : match.team_b} の勝利！</p>
          <p className="text-green-600 mt-2">ゲームスコア: {getGameScores()}</p>
        </div>
      )}

      {/* サーブ権選択 */}
      {needsServeSelection && match && currentGame && (
        <ServeSelection
          teamA={match.team_a || 'チーム A'}
          teamB={match.team_b || 'チーム B'}
          teamAPlayers={getPlayerNamesFromMatch(match, 'A')}
          teamBPlayers={getPlayerNamesFromMatch(match, 'B')}
          gameNumber={currentGame.game_number}
          preselectedTeam={currentGame.game_number > 1 && initialServeTeam ? determineInitialServeTeam(currentGame.game_number, initialServeTeam) : undefined}
          onServeTeamSelected={handleServeTeamSelected}
        />
      )}

      {!matchFinished && !needsServeSelection && !currentGame && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-center">
          <h2 className="text-lg font-semibold mb-2">{match.games && match.games.length > 0 ? '次のゲーム待ち' : '試合開始前'}</h2>
          <p className="text-gray-600 mb-4">
            {match.games && match.games.length > 0
              ? `第${match.games.length + 1}ゲームを開始するとサーブを決められます。`
              : 'まだゲームが開始されていません。第1ゲームを開始するとサーブを決められます。'}
          </p>
          <button
            onClick={match.games && match.games.length > 0 ? startNewGame : startFirstGame}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
          >
            {match.games && match.games.length > 0 ? `第${match.games.length + 1}ゲームを開始` : '第1ゲームを開始'}
          </button>
        </div>
      )}

      <div className={showDesktopVideoLayout ? 'xl:grid xl:grid-cols-[minmax(420px,1.35fr)_minmax(380px,0.9fr)] xl:items-start xl:gap-4' : ''}>
        {showDesktopVideoLayout && (
          <div className="hidden xl:flex xl:h-[calc(100vh-2rem)] xl:min-h-0 xl:flex-col xl:gap-4">
            {activeYouTubeVideoId && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-md">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">YouTube ポイント記録補助</h3>
                    <p className="text-xs text-gray-500">`Ctrl + S` で開始、`Ctrl + E` で終了、`Ctrl + D` で再生、`Ctrl + F` でクリア、`← / →` で 5 秒移動</p>
                  </div>
                  {youtubeEmbedBlocked && matchMetadata.youtube_url && (
                    <a href={matchMetadata.youtube_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                      YouTubeで開く
                    </a>
                  )}
                </div>

                {youtubeEmbedBlocked ? (
                  <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    この動画は埋め込み再生できなかったため、外部 YouTube で確認してください。
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-lg bg-black">
                      <YouTubeRangePlayer
                        ref={desktopYoutubePlayerRef}
                        videoId={activeYouTubeVideoId}
                        playerHeight={590}
                        onReady={() => restorePendingVideoPlayback('desktop')}
                        onEmbedBlocked={() => {
                          setYoutubeEmbedBlocked(true);
                          setMatchMetadata((current) => ({
                            ...current,
                            youtube_embed_allowed: false,
                          }));
                        }}
                        className="aspect-video w-full"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={resumeVideoPlayback} className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
                        続きから再生
                      </button>
                      <button type="button" onClick={pauseVideoPlayback} className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-white">
                        一時停止
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-medium">動画時刻</h4>
                  <p className="text-xs text-gray-500">開始だけでも保存できます。終了未設定時は詳細画面で 15 秒再生します。</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">開始時刻 (秒)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getVideoStartInput()}
                    onChange={(event) =>
                      setPointData({
                        ...pointData,
                        video_start_ms: parseSecondsInputToMs(event.target.value),
                      })
                    }
                    className="w-full rounded border p-2 text-sm"
                    placeholder="例: 83.4 or 1:23"
                  />
                  <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_start_ms, true)}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">終了時刻 (秒)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getVideoEndInput()}
                    onChange={(event) =>
                      setPointData({
                        ...pointData,
                        video_end_ms: parseSecondsInputToMs(event.target.value),
                      })
                    }
                    className="w-full rounded border p-2 text-sm"
                    placeholder="例: 95.0 or 1:35"
                  />
                  <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_end_ms, true)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">第{currentGame?.game_number}ゲーム</h3>
                  <p className="mt-1 text-2xl font-bold">{getGameScores()}</p>
                  <p className="text-xs text-gray-500">ゲームスコア</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{currentScore}</p>
                  <p className="text-xs text-gray-500">現在ポイント</p>
                </div>
              </div>

              {currentGame?.initial_serve_team && match && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${getCurrentServe() === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}
                  >
                    サーブ側: チーム{getCurrentServe()}
                  </div>
                  <div className="rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800">
                    サーバー: {getCurrentServingPlayer()?.playerName || '-'}
                  </div>
                </div>
              )}

              {gameWon && (
                <div className="mt-3 text-center">
                  <p className="text-sm font-semibold text-green-600">チーム{gameWon}の勝利</p>
                  {!matchFinished && (
                    <button onClick={startNewGame} className="mt-3 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
                      次のゲームを開始
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ゲームスコアと現在のゲーム状況を横並びで表示 */}
        {!matchFinished && !needsServeSelection && currentGame && (
          <div className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isPointInputActive ? 'xl:hidden' : ''}`}>
            {/* ゲームスコア */}
            <div className="bg-white rounded-lg shadow-md p-4 h-40 flex flex-col">
              <h3 className="text-lg font-semibold mb-3">ゲームスコア</h3>
              <div className="text-2xl font-bold text-center mb-3">{getGameScores()}</div>
              {/* 各ゲームの詳細スコア */}
              {match.games && match.games.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {match.games.map((game: Game) => (
                    <div key={game.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">第{game.game_number}ゲーム</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-bold ${game.winner_team === 'A' ? 'text-blue-600' : ''}`}>{game.points_a}</span>
                        <span className="text-sm">-</span>
                        <span className={`text-sm font-bold ${game.winner_team === 'B' ? 'text-red-600' : ''}`}>{game.points_b}</span>
                        {game.winner_team && <span className="text-xs text-green-600 ml-2">✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 現在のゲーム状況 */}
            <div className="bg-white rounded-lg shadow-md p-4 h-40">
              <h2 className="text-lg font-semibold mb-3">第{currentGame?.game_number}ゲーム</h2>

              {/* サーブ権表示 */}
              {currentGame?.initial_serve_team && match && (
                <div
                  className={`rounded-lg p-3 mb-3 ${
                    getCurrentServe() === 'A' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-sm mt-1">🏓 チーム{getCurrentServe()}のサーブ</div>
                  </div>
                </div>
              )}

              <div className="text-2xl font-bold text-center mb-3">{currentScore}</div>
              {gameWon && (
                <div className="text-center">
                  <p className="text-lg text-green-600 font-semibold">チーム{gameWon}の勝利！</p>
                  {!matchFinished && (
                    <button onClick={startNewGame} className="mt-4 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
                      次のゲームを開始
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ポイント入力フォーム */}
        {isPointInputActive && (
          <div className="xl:col-start-2 xl:row-start-1">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">{isEditMode ? 'ポイント編集' : 'ポイント記録'}</h3>
                {isEditMode && editingPoint && <p className="text-sm text-blue-600 mt-1">#{editingPoint.point_number} を編集中</p>}
                {!isEditMode && getCurrentServingPlayer() && (
                  <div className="mt-2">
                    {/* サーバー表示と手動選択を横並びに */}
                    {match &&
                      currentGame &&
                      (() => {
                        const servingTeam = getCurrentServe();
                        if (!servingTeam) return null;

                        const teamPlayers = getPlayerNamesFromMatch(match, servingTeam);
                        const isDoubles = teamPlayers.length > 1;

                        return (
                          <div className={`grid gap-3 ${isDoubles ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {/* サーバー表示 */}
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-m font-medium text-yellow-800">
                                サーブ: {getCurrentServingPlayer()?.playerName}
                                {manualServingPlayer && <span className="text-xs text-blue-600 ml-2">(手動選択)</span>}
                              </p>
                            </div>

                            {/* 手動サーブ選手選択（ダブルスの場合のみ） */}
                            {isDoubles && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex gap-2 justify-center">
                                  {teamPlayers.map((playerName, index) => (
                                    <button
                                      key={index}
                                      onClick={() => {
                                        setManualServingPlayer({
                                          team: servingTeam,
                                          playerIndex: index,
                                        });
                                      }}
                                      className={`px-3 py-1 text-xs border rounded font-medium transition-all ${
                                        manualServingPlayer?.team === servingTeam && manualServingPlayer?.playerIndex === index
                                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                                          : 'border-gray-300 hover:border-blue-300 text-gray-700'
                                      }`}
                                    >
                                      {playerName}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setManualServingPlayer(null)}
                                    className="px-3 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:border-red-300 hover:text-red-600"
                                  >
                                    自動
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>

              {/* サーブ情報 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-center">サーブ情報</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const currentServe = getCurrentServe();
                      const servingPlayer = getCurrentServingPlayer();
                      const servingPlayerName = servingPlayer?.playerName || '';
                      const servingPlayerKey = getPlayerUniqueId(
                        servingPlayer?.team || currentServe || 'A',
                        servingPlayer?.playerIndex || 0,
                        servingPlayerName,
                      );

                      setPointData({
                        ...pointData,
                        result_type: 'service_ace',
                        winner_team: currentServe || 'A',
                        winner_player: servingPlayerKey,
                        rally_count: 1,
                        // ダブルフォルト関連をクリア
                        double_fault: false,
                        loser_player: '',
                      });
                    }}
                    className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                      pointData.result_type === 'service_ace' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-green-300'
                    }`}
                  >
                    サービスエース
                  </button>
                  <button
                    disabled={pointData.result_type === 'double_fault'}
                    onClick={() => {
                      // ダブルフォルトが選択されている場合は何もしない
                      if (pointData.result_type === 'double_fault') {
                        return;
                      }
                      setPointData({
                        ...pointData,
                        first_serve_fault: !pointData.first_serve_fault,
                      });
                    }}
                    className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                      pointData.result_type === 'double_fault'
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : pointData.first_serve_fault
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 hover:border-orange-300'
                    }`}
                  >
                    1stフォルト
                  </button>
                  <button
                    onClick={() => {
                      const currentServe = getCurrentServe();
                      const oppositeTeam = currentServe === 'A' ? 'B' : 'A';
                      const servingPlayer = getCurrentServingPlayer();
                      const servingPlayerName = servingPlayer?.playerName || '';
                      const servingPlayerKey = getPlayerUniqueId(
                        servingPlayer?.team || currentServe || 'A',
                        servingPlayer?.playerIndex || 0,
                        servingPlayerName,
                      );

                      setPointData({
                        ...pointData,
                        result_type: 'double_fault',
                        double_fault: true,
                        first_serve_fault: true, // ダブルフォルトの場合は1stフォルトも自動設定
                        winner_team: oppositeTeam,
                        loser_player: servingPlayerKey,
                        rally_count: 1,
                        // サービスエース関連をクリア
                        winner_player: '',
                      });
                    }}
                    className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                      pointData.result_type === 'double_fault' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-purple-300'
                    }`}
                  >
                    ダブルフォルト
                  </button>
                </div>
              </div>

              {/* ラリー数 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-center">ラリー数</h4>
                <div className="overflow-x-auto">
                  <div className="flex gap-1 pb-2" style={{ minWidth: 'max-content' }}>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map((count) => (
                      <button
                        key={count}
                        onClick={() => setPointData({ ...pointData, rally_count: count })}
                        className={`flex-shrink-0 w-8 h-8 border-2 rounded font-medium transition-all text-xs ${
                          pointData.rally_count === count ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 hover:border-indigo-300'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ウィナー & ミス */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                {/* ウィナー */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-center text-green-600">ウィナー</h4>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { value: 'smash_winner', label: 'スマッシュ' },
                      { value: 'volley_winner', label: 'ボレー' },
                      { value: 'passing_winner', label: 'ストローク' },
                      { value: 'drop_winner', label: 'ドロップ' },
                      { value: 'net_in_winner', label: 'ネットイン' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => {
                          const newData = {
                            ...pointData,
                            result_type: value,
                            // サーブ関連の自動設定をクリア
                            double_fault: false,
                            loser_player: '',
                          };
                          // 関与選手が設定されていれば勝者チームを自動決定
                          if (pointData.winner_player) {
                            const autoWinner = determineWinnerTeam(pointData.winner_player, value);
                            if (autoWinner) {
                              newData.winner_team = autoWinner;
                            }
                          }
                          setPointData(newData);
                        }}
                        className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                          pointData.result_type === value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-green-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* ミス */}
                <div>
                  <h4 className="text-sm font-medium mb-2 text-center text-red-600">ミス</h4>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { value: 'net', label: 'ネット' },
                      { value: 'out', label: 'アウト' },
                      { value: 'smash_error', label: 'スマ失敗' },
                      { value: 'volley_error', label: 'ボレ失敗' },
                      { value: 'receive_error', label: 'レシーブ失敗' },
                      { value: 'follow_error', label: 'フォロー失敗' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => {
                          const newData = {
                            ...pointData,
                            result_type: value,
                            // レシーブ失敗の場合はラリー数を2に設定
                            rally_count: value === 'receive_error' ? 2 : pointData.rally_count,
                            // サーブ関連の自動設定をクリア（ただしダブルフォルト以外）
                            double_fault: false,
                            winner_player: '',
                          };
                          // 関与選手が設定されていれば勝者チームを自動決定
                          if (pointData.winner_player) {
                            const autoWinner = determineWinnerTeam(pointData.winner_player, value);
                            if (autoWinner) {
                              newData.winner_team = autoWinner;
                            }
                          }
                          setPointData(newData);
                        }}
                        className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                          pointData.result_type === value ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 関与選手 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-center">関与選手</h4>
                {/* サービスエース・ダブルフォルト時の自動設定表示 */}
                {(pointData.result_type === 'service_ace' || pointData.result_type === 'double_fault') && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
                    <p className="text-xs text-yellow-800">
                      {pointData.result_type === 'service_ace'
                        ? 'サービスエース：サーブ選手が自動選択されています'
                        : 'ダブルフォルト：サーブ選手と1stフォルトが自動選択されています'}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">現在のサーブ選手: {getCurrentServingPlayer()?.playerName}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {/* チームA選手 */}
                  <div>
                    <h5 className="text-xs font-medium mb-1 text-center text-blue-600">チーム A</h5>
                    <div className="grid grid-cols-2 gap-1">
                      {getPlayerNamesFromMatch(match, 'A').map((playerName: string, index: number) => {
                        const uniqueId = getPlayerUniqueId('A', index, playerName);
                        const isAutoSelected = pointData.result_type === 'service_ace' || pointData.result_type === 'double_fault';
                        return (
                          <button
                            key={uniqueId}
                            disabled={isAutoSelected}
                            onClick={() => {
                              // サービスエース・ダブルフォルトの場合は自動設定のため何もしない
                              if (isAutoSelected) {
                                return;
                              }

                              const newData = { ...pointData };

                              // エラー系の結果タイプの場合はloser_playerに設定、それ以外はwinner_playerに設定
                              const errorTypes = ['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error'];
                              if (pointData.result_type && errorTypes.includes(pointData.result_type)) {
                                newData.loser_player = uniqueId;
                                // winner_playerをクリアする場合もある
                                if (pointData.winner_player === uniqueId) {
                                  newData.winner_player = '';
                                }
                              } else {
                                newData.winner_player = uniqueId;
                                // loser_playerをクリアする場合もある
                                if (pointData.loser_player === uniqueId) {
                                  newData.loser_player = '';
                                }
                              }

                              // 結果タイプが設定されていれば勝者チームを自動決定
                              if (pointData.result_type) {
                                const playerFieldToUse = errorTypes.includes(pointData.result_type) ? newData.loser_player : newData.winner_player;
                                if (playerFieldToUse) {
                                  const autoWinner = determineWinnerTeam(playerFieldToUse, pointData.result_type);
                                  if (autoWinner) {
                                    newData.winner_team = autoWinner;
                                  }
                                }
                              }
                              setPointData(newData);
                            }}
                            className={`p-1 border-2 rounded font-medium transition-all text-xs ${
                              isAutoSelected
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : pointData.winner_player === uniqueId
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : pointData.loser_player === uniqueId
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-300 hover:border-blue-300'
                            }`}
                          >
                            {playerName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* チームB選手 */}
                  <div>
                    <h5 className="text-xs font-medium mb-1 text-center text-red-600">チーム B</h5>
                    <div className="grid grid-cols-2 gap-1">
                      {getPlayerNamesFromMatch(match, 'B').map((playerName: string, index: number) => {
                        const uniqueId = getPlayerUniqueId('B', index, playerName);
                        const isAutoSelected = pointData.result_type === 'service_ace' || pointData.result_type === 'double_fault';
                        return (
                          <button
                            key={uniqueId}
                            disabled={isAutoSelected}
                            onClick={() => {
                              // サービスエース・ダブルフォルトの場合は自動設定のため何もしない
                              if (isAutoSelected) {
                                return;
                              }
                              const newData = { ...pointData };

                              // エラー系の結果タイプの場合はloser_playerに設定、それ以外はwinner_playerに設定
                              const errorTypes = ['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error'];
                              if (pointData.result_type && errorTypes.includes(pointData.result_type)) {
                                newData.loser_player = uniqueId;
                                // winner_playerをクリアする場合もある
                                if (pointData.winner_player === uniqueId) {
                                  newData.winner_player = '';
                                }
                              } else {
                                newData.winner_player = uniqueId;
                                // loser_playerをクリアする場合もある
                                if (pointData.loser_player === uniqueId) {
                                  newData.loser_player = '';
                                }
                              }

                              // 結果タイプが設定されていれば勝者チームを自動決定
                              if (pointData.result_type) {
                                const playerFieldToUse = errorTypes.includes(pointData.result_type) ? newData.loser_player : newData.winner_player;
                                if (playerFieldToUse) {
                                  const autoWinner = determineWinnerTeam(playerFieldToUse, pointData.result_type);
                                  if (autoWinner) {
                                    newData.winner_team = autoWinner;
                                  }
                                }
                              }
                              setPointData(newData);
                            }}
                            className={`p-1 border-2 rounded font-medium transition-all text-xs ${
                              isAutoSelected
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                : pointData.winner_player === uniqueId
                                  ? 'border-red-500 bg-red-50 text-red-700'
                                  : pointData.loser_player === uniqueId
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-300 hover:border-red-300'
                            }`}
                          >
                            {playerName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 勝者チーム */}
              <div className={`mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 ${isPointInputActive ? 'xl:hidden' : ''}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">動画時刻</h4>
                    <p className="text-xs text-gray-500">開始だけでも保存できます。終了未設定時は詳細画面で 15 秒再生します。</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">開始時刻 (秒)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getVideoStartInput()}
                      onChange={(event) =>
                        setPointData({
                          ...pointData,
                          video_start_ms: parseSecondsInputToMs(event.target.value),
                        })
                      }
                      className="w-full rounded border p-2 text-sm"
                      placeholder="例: 83.4 or 1:23"
                    />
                    <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_start_ms, true)}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">終了時刻 (秒)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getVideoEndInput()}
                      onChange={(event) =>
                        setPointData({
                          ...pointData,
                          video_end_ms: parseSecondsInputToMs(event.target.value),
                        })
                      }
                      className="w-full rounded border p-2 text-sm"
                      placeholder="例: 95.0 or 1:35"
                    />
                    <p className="mt-1 text-xs text-gray-500">表示: {formatVideoTimestamp(pointData.video_end_ms, true)}</p>
                  </div>
                </div>
              </div>

              {/* 勝者チーム */}
              <div className="mb-4">
                <div className="text-center mb-2">
                  <h4 className="text-sm font-medium">勝者チーム</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPointData({ ...pointData, winner_team: 'A' })}
                    className={`p-2 border-2 rounded font-medium transition-all text-sm ${
                      pointData.winner_team === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    チーム A
                  </button>
                  <button
                    onClick={() => setPointData({ ...pointData, winner_team: 'B' })}
                    className={`p-2 border-2 rounded font-medium transition-all text-sm ${
                      pointData.winner_team === 'B' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
                    }`}
                  >
                    チーム B
                  </button>
                </div>
              </div>

              {/* 送信ボタン */}
              <div className="mt-6 flex gap-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={updatePoint}
                      disabled={!pointData.winner_team || submitting}
                      className="flex-1 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      {submitting ? '更新中...' : 'ポイント更新'}
                    </button>
                    <button
                      onClick={cancelEditPoint}
                      disabled={submitting}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <button
                    onClick={submitPoint}
                    disabled={!pointData.winner_team || submitting}
                    className="flex-1 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
                  >
                    {submitting ? '記録中...' : 'ポイント記録'}
                  </button>
                )}
              </div>

              {activeYouTubeVideoId && !youtubeEmbedBlocked && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => captureVideoTime('start')}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                  >
                    開始を記録
                  </button>
                  <button
                    type="button"
                    onClick={() => captureVideoTime('end')}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                  >
                    終了を記録
                  </button>
                  <button type="button" onClick={clearVideoRange} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-white">
                    クリア
                  </button>
                </div>
              )}
            </div>

            {gameHistorySection}
          </div>
        )}

        {!isPointInputActive && gameHistorySection}
      </div>
    </div>
  );
};

export default MatchInput;
function useCallback(callback: () => Promise<void>, dependencies: (string | string[] | undefined)[]) {
  return reactUseCallback(callback, dependencies);
}
