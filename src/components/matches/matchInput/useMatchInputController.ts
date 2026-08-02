import { useRouter } from 'next/router';
import { useCallback as reactUseCallback, useEffect, useRef, useState } from 'react';

import { hasLiveMatchApi } from '../../../../lib/betaMatchesClient';
import { isDebugMode } from '../../../../lib/env';
import {
  getMatchWinner,
  getPlayerNameFromId,
  getPlayerNamesFromMatch,
  getPlayerUniqueId,
  getTeamFromPlayerId,
  isMatchFinished,
} from '../../../../lib/matchLogic';
import { determineInitialServeTeam, getCurrentServingPlayerIndex, getCurrentServingTeam } from '../../../../lib/serveHelpers';
import { getGamesWon, isMatchFinishedByGames } from '../../../../lib/videoReview';
import { formatMsForInput, normalizeYouTubeInput } from '../../../../lib/youtubePlayback';
import type { YouTubeRangePlayerHandle } from '../../../components/YouTubeRangePlayer';
import type { Game, Match, Point } from '../../../types/database';
import { EMPTY_POINT_DATA, type ManualServingPlayer, type MatchMetadataState, type PointDataState, type ServingPlayerInfo } from './types';

// next/router 経由の useCallback ラッパー。元実装の挙動をそのまま維持している。
function useCallback(callback: () => Promise<void>, dependencies: (string | string[] | undefined)[]) {
  return reactUseCallback(callback, dependencies);
}

/**
 * `/beta/matches/[matchId]/input` の状態管理・API連携・派生値の計算をまとめたフック。
 * ページ側は本フックが返す値をそのまま各サブコンポーネントへ渡す。
 */
export const useMatchInputController = () => {
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
  const [matchMetadata, setMatchMetadata] = useState<MatchMetadataState>({
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
  const [manualServingPlayer, setManualServingPlayer] = useState<ManualServingPlayer>(null);

  // ポイント入力フォームの状態
  const [pointData, setPointData] = useState<PointDataState>(EMPTY_POINT_DATA);

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
        const matchFinishedFromFetch = isMatchFinishedByGames(data.match.best_of, gamesWonA, gamesWonB);

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
          } else if (matchFinishedFromFetch) {
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

  const withAutoCapturedVideoEnd = (data: PointDataState) => {
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
    setPointData({ ...EMPTY_POINT_DATA });
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
      setPointData({ ...EMPTY_POINT_DATA });

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
            const { gamesWonA: nextGamesWonA, gamesWonB: nextGamesWonB } = getGamesWon(updatedMatch);
            const finished = isMatchFinishedByGames(updatedMatch.best_of, nextGamesWonA, nextGamesWonB);

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
  const getCurrentServingPlayer = (): ServingPlayerInfo => {
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
  const getServingPlayerForPoint = (game: Game, pointNumber: number): ServingPlayerInfo => {
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

  // ゲームスコア表示用（チーム別の獲得ゲーム数）
  const getGameScores = () => {
    if (!match || !match.games) return '';

    const gamesWonA = match.games.filter((game: Game) => game.winner_team === 'A').length;
    const gamesWonB = match.games.filter((game: Game) => game.winner_team === 'B').length;

    return `${gamesWonA} - ${gamesWonB}`;
  };

  // --- 描画用の派生値 ---
  const currentScore = currentGame ? `${currentGame.points_a} - ${currentGame.points_b}` : '';
  const gameWon = currentGame?.winner_team ?? null;
  const matchFinished = match ? isMatchFinished(match) : false;
  const matchWinner = match ? getMatchWinner(match) : null;
  const isPointInputActive = Boolean(currentGame && ((!gameWon && !matchFinished && !needsServeSelection) || isEditMode));
  const activeYouTubeVideoId = getActiveYouTubeVideoId();
  const showDesktopVideoLayout = Boolean(activeYouTubeVideoId && isXlViewport && (isPointInputActive || needsServeSelection));
  const sortedGames = match
    ? [...(match.games ?? [])].sort((a, b) => {
        if (currentGame) {
          if (a.id === currentGame.id) return -1;
          if (b.id === currentGame.id) return 1;
        }

        return a.game_number - b.game_number;
      })
    : [];

  return {
    // アクセス制御・読み込み状態
    canEditMatches,
    loading,
    match,

    // ゲーム進行状態
    currentGame,
    initialServeTeam,
    needsServeSelection,
    isEditMode,
    editingPoint,
    submitting,
    manualServingPlayer,
    setManualServingPlayer,

    // 試合メタデータ
    matchMetadata,
    setMatchMetadata,
    metadataSaving,
    updateMatchMetadata,
    youtubeEmbedBlocked,
    setYoutubeEmbedBlocked,

    // 動画プレイヤー
    mobileYoutubePlayerRef,
    desktopYoutubePlayerRef,
    isXlViewport,
    activeYouTubeVideoId,
    showDesktopVideoLayout,
    restorePendingVideoPlayback,
    resumeVideoPlayback,
    pauseVideoPlayback,
    captureVideoTime,
    clearVideoRange,
    jumpToPointVideo,
    getVideoStartInput,
    getVideoEndInput,

    // ポイント入力フォーム
    pointData,
    setPointData,
    submitPoint,
    updatePoint,
    startEditPoint,
    cancelEditPoint,

    // ゲーム操作
    startNewGame,
    startFirstGame,
    handleServeTeamSelected,
    getCurrentServe,
    getCurrentServingPlayer,
    getServingPlayerForPoint,
    getGameScores,

    // 派生値
    currentScore,
    gameWon,
    matchFinished,
    matchWinner,
    isPointInputActive,
    sortedGames,
  };
};
