import Error from 'next/error';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useCallback as reactUseCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  fetchBetaMatchById,
  hasLiveMatchApi,
} from '../../../../../lib/betaMatchesClient';
import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
} from '../../../../../lib/videoReview';
import { isDebugMode } from '../../../../../lib/env';
import { isScoreSiteMode } from '../../../../../lib/siteConfig';
import {
  Game,
  Match,
  MatchVideoSession,
  Point,
} from '../../../../types/database';

type TeamEditorState = {
  entry_number: string;
  player1_last_name: string;
  player1_first_name: string;
  player1_team_name: string;
  player1_region: string;
  player2_last_name: string;
  player2_first_name: string;
  player2_team_name: string;
  player2_region: string;
};

type VideoSessionListResponse = {
  sessions?: MatchVideoSession[];
};

type ActiveYoutubeSource = {
  input: string;
  label: string;
  sourceType: 'session' | 'match';
};

type SelectedPointMeta = {
  gameNumber: number;
  point: Point;
};

const createTeamEditorState = (
  match: Match,
  team: 'A' | 'B',
): TeamEditorState => {
  const prefix = `team_${team.toLowerCase()}` as 'team_a' | 'team_b';

  return {
    entry_number:
      (match[`${prefix}_entry_number` as keyof Match] as string) ?? '',
    player1_last_name:
      (match[`${prefix}_player1_last_name` as keyof Match] as string) ?? '',
    player1_first_name:
      (match[`${prefix}_player1_first_name` as keyof Match] as string) ?? '',
    player1_team_name:
      (match[`${prefix}_player1_team_name` as keyof Match] as string) ?? '',
    player1_region:
      (match[`${prefix}_player1_region` as keyof Match] as string) ?? '',
    player2_last_name:
      (match[`${prefix}_player2_last_name` as keyof Match] as string) ?? '',
    player2_first_name:
      (match[`${prefix}_player2_first_name` as keyof Match] as string) ?? '',
    player2_team_name:
      (match[`${prefix}_player2_team_name` as keyof Match] as string) ?? '',
    player2_region:
      (match[`${prefix}_player2_region` as keyof Match] as string) ?? '',
  };
};

const formatVideoTimestamp = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
};

const MatchDetail = () => {
  const scoreSiteMode = isScoreSiteMode();
  const router = useRouter();
  const { matchId } = router.query;
  const canEditMatches = isDebugMode() && hasLiveMatchApi();

  const [match, setMatch] = useState<Match | null>(null);
  const [videoSessions, setVideoSessions] = useState<MatchVideoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPoint, setEditingPoint] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Point>>({});
  const [teamAData, setTeamAData] = useState<TeamEditorState | null>(null);
  const [teamBData, setTeamBData] = useState<TeamEditorState | null>(null);
  const [teamSaving, setTeamSaving] = useState(false);
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const fetchMatch = reactUseCallback(async () => {
    if (typeof matchId !== 'string') return;

    setLoading(true);
    try {
      const [loadedMatch, sessions] = await Promise.all([
        fetchBetaMatchById(matchId),
        hasLiveMatchApi()
          ? fetch(`/api/matches/${matchId}/video-sessions`)
              .then(async (response) => {
                if (!response.ok) {
                  throw new globalThis.Error('Failed to load video sessions.');
                }

                const data =
                  (await response.json()) as VideoSessionListResponse;
                return data.sessions ?? [];
              })
              .catch((error) => {
                console.error('Failed to fetch video sessions:', error);
                return [] as MatchVideoSession[];
              })
          : Promise.resolve([] as MatchVideoSession[]),
      ]);

      setMatch(loadedMatch);
      setVideoSessions(sessions);

      if (loadedMatch) {
        setTeamAData(createTeamEditorState(loadedMatch, 'A'));
        setTeamBData(createTeamEditorState(loadedMatch, 'B'));
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (matchId && isDebugMode()) {
      void fetchMatch();
    }
  }, [matchId, fetchMatch]);

  const activeYoutubeSource = useMemo<ActiveYoutubeSource | null>(() => {
    const youtubeSession = videoSessions.find(
      (session) =>
        session.source_type === 'youtube' &&
        Boolean(session.source_url ?? session.youtube_video_id),
    );

    if (youtubeSession) {
      return {
        input:
          youtubeSession.source_url ?? youtubeSession.youtube_video_id ?? '',
        label: youtubeSession.source_label || '最新の動画セッション',
        sourceType: 'session',
      };
    }

    if (match?.youtube_url) {
      return {
        input: match.youtube_url,
        label: 'マッチに設定された YouTube',
        sourceType: 'match',
      };
    }

    if (match?.youtube_video_id) {
      return {
        input: match.youtube_video_id,
        label: 'マッチに設定された YouTube',
        sourceType: 'match',
      };
    }

    return null;
  }, [match?.youtube_url, match?.youtube_video_id, videoSessions]);

  const playerEmbedUrl = useMemo(() => {
    if (!activeYoutubeSource) return null;
    return buildYouTubeEmbedUrl(activeYoutubeSource.input, playerStartSeconds);
  }, [activeYoutubeSource, playerStartSeconds]);

  const externalYoutubeUrl = useMemo(() => {
    if (!activeYoutubeSource) return null;
    return buildYouTubeWatchUrl(activeYoutubeSource.input);
  }, [activeYoutubeSource]);

  const selectedPointMeta = useMemo<SelectedPointMeta | null>(() => {
    if (!match?.games || !selectedPointId) return null;

    for (const game of match.games) {
      const point = game.points?.find((entry) => entry.id === selectedPointId);
      if (point) {
        return {
          gameNumber: game.game_number,
          point,
        };
      }
    }

    return null;
  }, [match?.games, selectedPointId]);

  useEffect(() => {
    if (selectedPointMeta) return;

    if (selectedPointId !== null) {
      setSelectedPointId(null);
    }
  }, [selectedPointId, selectedPointMeta]);

  if (scoreSiteMode) {
    return <Error statusCode={404} />;
  }

  const getMatchWinner = () => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter(
      (game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      smash_winner: 'スマッシュウィナー',
      volley_winner: 'ボレーウィナー',
      passing_winner: 'ストロークウィナー',
      drop_winner: 'ドロップウィナー',
      net_in_winner: 'ネットインウィナー',
      service_ace: 'サービスエース',
      net: 'ネット',
      out: 'アウト',
      smash_error: 'スマッシュミス',
      volley_error: 'ボレーミス',
      double_fault: 'ダブルフォルト',
      follow_error: 'フォローミス',
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
    };
    return labels[type] || type;
  };

  const handlePlayPointVideo = (point: Point) => {
    if (!activeYoutubeSource || point.video_start_ms == null) return;

    setSelectedPointId(point.id);
    setPlayerStartSeconds(Math.max(0, Math.floor(point.video_start_ms / 1000)));
  };

  const handleEditPoint = (point: Point) => {
    setEditingPoint(point.id);
    setEditingData({
      winner_team: point.winner_team as 'A' | 'B',
      result_type: point.result_type,
      rally_count: point.rally_count,
      first_serve_fault: point.first_serve_fault,
      double_fault: point.double_fault,
      winner_player: point.winner_player,
      loser_player: point.loser_player,
    });
  };

  const handleSavePoint = async () => {
    if (!canEditMatches || !editingPoint || !matchId) return;

    try {
      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          point_id: editingPoint,
          ...editingData,
        }),
      });

      if (response.ok) {
        setEditingPoint(null);
        setEditingData({});
        await fetchMatch();
      } else {
        const errorText = await response.text();
        console.error('API error:', errorText);
        alert('ポイントの更新に失敗しました: ' + errorText);
      }
    } catch (error) {
      console.error('Failed to update point:', error);
      alert('ポイントの更新に失敗しました');
    }
  };

  const handleCancelEdit = () => {
    setEditingPoint(null);
    setEditingData({});
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!canEditMatches) {
      alert('この環境ではポイントの削除はできません');
      return;
    }

    if (!confirm('このポイントを削除しますか？')) return;

    try {
      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          point_id: pointId,
        }),
      });

      if (response.ok) {
        await fetchMatch();
      } else {
        const errorText = await response.text();
        console.error('Delete API error:', errorText);
        alert('ポイントの削除に失敗しました: ' + errorText);
      }
    } catch (error) {
      console.error('Failed to delete point:', error);
      alert('ポイントの削除に失敗しました');
    }
  };

  const handleSaveTeams = async () => {
    if (
      !canEditMatches ||
      typeof matchId !== 'string' ||
      !match ||
      !teamAData ||
      !teamBData
    ) {
      return;
    }

    setTeamSaving(true);

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_a_entry_number: teamAData.entry_number,
          team_a_player1_last_name: teamAData.player1_last_name,
          team_a_player1_first_name: teamAData.player1_first_name,
          team_a_player1_team_name: teamAData.player1_team_name,
          team_a_player1_region: teamAData.player1_region,
          team_a_player2_last_name: teamAData.player2_last_name,
          team_a_player2_first_name: teamAData.player2_first_name,
          team_a_player2_team_name: teamAData.player2_team_name,
          team_a_player2_region: teamAData.player2_region,
          team_b_entry_number: teamBData.entry_number,
          team_b_player1_last_name: teamBData.player1_last_name,
          team_b_player1_first_name: teamBData.player1_first_name,
          team_b_player1_team_name: teamBData.player1_team_name,
          team_b_player1_region: teamBData.player1_region,
          team_b_player2_last_name: teamBData.player2_last_name,
          team_b_player2_first_name: teamBData.player2_first_name,
          team_b_player2_team_name: teamBData.player2_team_name,
          team_b_player2_region: teamBData.player2_region,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new globalThis.Error(errorText || 'Failed to save team data.');
      }

      await fetchMatch();
    } catch (error) {
      console.error('Failed to update teams:', error);
      alert('チーム情報の更新に失敗しました。');
    } finally {
      setTeamSaving(false);
    }
  };

  if (!isDebugMode()) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          <strong className="font-bold">アクセス拒否</strong>
          <span className="ml-2 block sm:inline">
            この機能は開発環境でのみ利用可能です。
          </span>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!match) return <div className="p-6">Match not found</div>;

  const matchWinner = getMatchWinner();
  const isDoublesMatch =
    match.game_type === 'doubles' ||
    Boolean(
      match.team_a_player2_last_name ||
        match.team_a_player2_first_name ||
        match.team_b_player2_last_name ||
        match.team_b_player2_first_name,
    );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href="/beta/matches" className="text-blue-500 hover:underline">
          ← マッチ一覧に戻る
        </Link>
        {canEditMatches ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/beta/matches/${matchId}/video-review`}
              className="rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600"
            >
              動画レビュー
            </Link>
            <Link
              href={`/beta/matches/${matchId}/input`}
              className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
            >
              記録入力
            </Link>
          </div>
        ) : (
          <span className="text-sm text-gray-500">静的公開中: 閲覧のみ</span>
        )}
      </div>

      <section className="sticky top-4 z-20 mb-6">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="aspect-video w-full bg-black">
            {playerEmbedUrl ? (
              <iframe
                key={`${playerEmbedUrl}-${selectedPointId ?? 'default'}`}
                src={playerEmbedUrl}
                title="YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-300">
                動画が設定されていないため、この試合ではポイントジャンプを利用できません。
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {activeYoutubeSource
                    ? 'ポイント連動プレイヤー'
                    : '動画ソース未設定'}
                </p>
                <p className="text-xs text-gray-500">
                  {activeYoutubeSource
                    ? `${activeYoutubeSource.label} / ${
                        activeYoutubeSource.sourceType === 'session'
                          ? '動画セッション'
                          : 'マッチ設定'
                      }`
                    : 'YouTube セッションか match.youtube_url を設定するとここに表示されます。'}
                </p>
              </div>
              {externalYoutubeUrl && (
                <a
                  href={externalYoutubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  YouTubeで開く
                </a>
              )}
            </div>

            {selectedPointMeta ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                  第{selectedPointMeta.gameNumber}ゲーム #
                  {selectedPointMeta.point.point_number}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  開始{' '}
                  {formatVideoTimestamp(
                    selectedPointMeta.point.video_start_ms ?? 0,
                  )}
                </span>
                {selectedPointMeta.point.video_end_ms != null && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    終了{' '}
                    {formatVideoTimestamp(selectedPointMeta.point.video_end_ms)}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  ポイントをタップするとこのプレイヤーがその位置から再生されます。
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                下のポイント一覧から動画時刻付きポイントを選ぶと、ここでその場面を確認できます。
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
        <h1 className="mb-4 text-2xl font-bold">
          {match.team_a} vs {match.team_b}
        </h1>
        <p className="mb-2 text-gray-600">大会: {match.tournament_name}</p>
        <p className="mb-4 text-gray-600">形式: {match.best_of} ゲームマッチ</p>

        {teamAData && teamBData && canEditMatches && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">チーム情報編集</h2>
              <button
                type="button"
                onClick={handleSaveTeams}
                disabled={teamSaving}
                className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:bg-gray-300"
              >
                {teamSaving ? '保存中...' : 'チーム情報を保存'}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ['A', 'チーム A', teamAData, setTeamAData, 'blue'],
                  ['B', 'チーム B', teamBData, setTeamBData, 'red'],
                ] as const
              ).map(([teamKey, label, teamData, setTeamData, color]) => (
                <div
                  key={teamKey}
                  className={`rounded border p-4 ${
                    color === 'blue'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <h3 className="mb-3 font-semibold">{label}</h3>
                  <div className="grid gap-3">
                    <input
                      type="text"
                      value={teamData.entry_number}
                      onChange={(e) =>
                        setTeamData({
                          ...teamData,
                          entry_number: e.target.value,
                        })
                      }
                      className="rounded border p-2 text-sm"
                      placeholder="エントリー番号"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        type="text"
                        value={teamData.player1_last_name}
                        onChange={(e) =>
                          setTeamData({
                            ...teamData,
                            player1_last_name: e.target.value,
                          })
                        }
                        className="rounded border p-2 text-sm"
                        placeholder="選手1 姓"
                      />
                      <input
                        type="text"
                        value={teamData.player1_first_name}
                        onChange={(e) =>
                          setTeamData({
                            ...teamData,
                            player1_first_name: e.target.value,
                          })
                        }
                        className="rounded border p-2 text-sm"
                        placeholder="選手1 名"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        type="text"
                        value={teamData.player1_team_name}
                        onChange={(e) =>
                          setTeamData({
                            ...teamData,
                            player1_team_name: e.target.value,
                          })
                        }
                        className="rounded border p-2 text-sm"
                        placeholder="選手1 所属"
                      />
                      <input
                        type="text"
                        value={teamData.player1_region}
                        onChange={(e) =>
                          setTeamData({
                            ...teamData,
                            player1_region: e.target.value,
                          })
                        }
                        className="rounded border p-2 text-sm"
                        placeholder="選手1 地域"
                      />
                    </div>

                    {isDoublesMatch && (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            value={teamData.player2_last_name}
                            onChange={(e) =>
                              setTeamData({
                                ...teamData,
                                player2_last_name: e.target.value,
                              })
                            }
                            className="rounded border p-2 text-sm"
                            placeholder="選手2 姓"
                          />
                          <input
                            type="text"
                            value={teamData.player2_first_name}
                            onChange={(e) =>
                              setTeamData({
                                ...teamData,
                                player2_first_name: e.target.value,
                              })
                            }
                            className="rounded border p-2 text-sm"
                            placeholder="選手2 名"
                          />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            value={teamData.player2_team_name}
                            onChange={(e) =>
                              setTeamData({
                                ...teamData,
                                player2_team_name: e.target.value,
                              })
                            }
                            className="rounded border p-2 text-sm"
                            placeholder="選手2 所属"
                          />
                          <input
                            type="text"
                            value={teamData.player2_region}
                            onChange={(e) =>
                              setTeamData({
                                ...teamData,
                                player2_region: e.target.value,
                              })
                            }
                            className="rounded border p-2 text-sm"
                            placeholder="選手2 地域"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {matchWinner && (
          <div className="rounded border border-green-400 bg-green-100 p-4">
            <p className="text-lg font-semibold text-green-800">
              🏆 チーム{matchWinner} (
              {matchWinner === 'A' ? match.team_a : match.team_b}) の勝利！
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold">ゲーム結果</h2>
        <div className="grid gap-4">
          {match.games?.map((game: Game) => (
            <div key={game.id} className="rounded border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">第{game.game_number}ゲーム</h3>
                {game.winner_team && (
                  <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-800">
                    チーム{game.winner_team}勝利
                  </span>
                )}
              </div>
              <div className="mb-4 text-2xl font-bold">
                <span
                  className={game.winner_team === 'A' ? 'text-green-600' : ''}
                >
                  {game.points_a}
                </span>
                {' - '}
                <span
                  className={game.winner_team === 'B' ? 'text-green-600' : ''}
                >
                  {game.points_b}
                </span>
              </div>

              {game.points && game.points.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 font-medium">ポイント履歴</h4>
                  <div className="space-y-2">
                    {game.points.map((point: Point) => {
                      const hasVideoAnchor = point.video_start_ms != null;
                      const isSelectedPoint = point.id === selectedPointId;

                      return (
                        <div
                          key={point.id}
                          className={`rounded border p-3 transition ${
                            isSelectedPoint
                              ? 'border-blue-300 bg-blue-50 shadow-sm'
                              : 'border-transparent bg-gray-50'
                          }`}
                        >
                          {editingPoint === point.id ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium">
                                  #{point.point_number}
                                </span>
                                <select
                                  value={editingData.winner_team || ''}
                                  onChange={(e) =>
                                    setEditingData({
                                      ...editingData,
                                      winner_team: e.target.value as 'A' | 'B',
                                    })
                                  }
                                  className="rounded border px-2 py-1"
                                >
                                  <option value="A">チームA</option>
                                  <option value="B">チームB</option>
                                </select>
                                <select
                                  value={editingData.result_type || ''}
                                  onChange={(e) =>
                                    setEditingData({
                                      ...editingData,
                                      result_type: e.target.value,
                                    })
                                  }
                                  className="rounded border px-2 py-1"
                                >
                                  <option value="winner">決定打</option>
                                  <option value="forced_error">ミス誘発</option>
                                  <option value="unforced_error">凡ミス</option>
                                  <option value="net">ネット</option>
                                  <option value="out">アウト</option>
                                </select>
                                <input
                                  type="number"
                                  placeholder="ラリー数"
                                  value={editingData.rally_count || ''}
                                  onChange={(e) =>
                                    setEditingData({
                                      ...editingData,
                                      rally_count:
                                        parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 rounded border px-2 py-1"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={
                                      editingData.first_serve_fault || false
                                    }
                                    onChange={(e) =>
                                      setEditingData({
                                        ...editingData,
                                        first_serve_fault: e.target.checked,
                                      })
                                    }
                                  />
                                  <span className="text-xs">1stフォルト</span>
                                </label>
                                <label className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={editingData.double_fault || false}
                                    onChange={(e) =>
                                      setEditingData({
                                        ...editingData,
                                        double_fault: e.target.checked,
                                      })
                                    }
                                  />
                                  <span className="text-xs">
                                    ダブルフォルト
                                  </span>
                                </label>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSavePoint}
                                  className="rounded bg-green-500 px-3 py-1 text-xs text-white hover:bg-green-600"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium">
                                  #{point.point_number}
                                </span>
                                <span className="rounded bg-blue-100 px-2 py-1">
                                  チーム{point.winner_team}
                                </span>
                                <span>
                                  {getResultTypeLabel(point.result_type || '')}
                                </span>
                                <span>{point.rally_count}ラリー</span>
                                {point.winner_player && (
                                  <span className="text-blue-600">
                                    {point.winner_player}
                                  </span>
                                )}
                                {point.first_serve_fault && (
                                  <span className="text-xs text-orange-600">
                                    1stフォルト
                                  </span>
                                )}
                                {point.double_fault && (
                                  <span className="text-xs text-red-600">
                                    ダブルフォルト
                                  </span>
                                )}
                              </div>

                              {hasVideoAnchor && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                    動画{' '}
                                    {formatVideoTimestamp(
                                      point.video_start_ms ?? 0,
                                    )}
                                    {point.video_end_ms != null
                                      ? ` - ${formatVideoTimestamp(point.video_end_ms)}`
                                      : ' から'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handlePlayPointVideo(point)}
                                    disabled={!playerEmbedUrl}
                                    className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                  >
                                    このポイントを見る
                                  </button>
                                  {isSelectedPoint && (
                                    <span className="text-xs font-medium text-blue-700">
                                      再生中のポイント
                                    </span>
                                  )}
                                </div>
                              )}

                              {canEditMatches && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditPoint(point)}
                                    className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                                  >
                                    編集
                                  </button>
                                  <button
                                    onClick={() => handleDeletePoint(point.id)}
                                    className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                                  >
                                    削除
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold">統計情報</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold">
              {match.games?.reduce(
                (sum, game) => sum + (game.points?.length || 0),
                0,
              )}
            </div>
            <div className="text-sm text-gray-600">総ポイント数</div>
          </div>
          <div className="rounded bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold">
              {match.games?.filter((game) => game.winner_team === 'A').length} -{' '}
              {match.games?.filter((game) => game.winner_team === 'B').length}
            </div>
            <div className="text-sm text-gray-600">ゲーム数</div>
          </div>
          <div className="rounded bg-gray-50 p-4 text-center">
            <div className="text-2xl font-bold">
              {match.games?.reduce(
                (sum, game) =>
                  sum +
                  (game.points?.reduce(
                    (pSum, point) => pSum + (point.rally_count || 0),
                    0,
                  ) || 0),
                0,
              )}
            </div>
            <div className="text-sm text-gray-600">総ラリー数</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDetail;
