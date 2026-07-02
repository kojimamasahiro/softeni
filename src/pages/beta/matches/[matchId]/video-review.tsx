import Error from 'next/error';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { hasLiveMatchApi } from '../../../../../lib/betaMatchesClient';
import { isDebugMode } from '../../../../../lib/env';
import { isScoreSiteMode } from '../../../../../lib/siteConfig';
import { buildYouTubeEmbedUrl, formatDurationLabel, getConfidenceLabel, parseYouTubeVideoId, VIDEO_REVIEW_RESULT_TYPES } from '../../../../../lib/videoReview';
import type { Match, MatchPointCandidate, MatchVideoSession } from '../../../../types/database';

type SessionListResponse = {
  sessions?: MatchVideoSession[];
};

type SessionDetailResponse = {
  session?: MatchVideoSession | null;
};

type MatchResponse = {
  match?: Match | null;
};

type CandidateEditorState = {
  status: 'pending' | 'confirmed' | 'excluded' | null;
  winner_team: 'A' | 'B' | null;
  serving_team: 'A' | 'B' | null;
  serving_player: string;
  rally_count: number;
  first_serve_fault: boolean;
  double_fault: boolean;
  result_type: string;
  winner_player: string;
  loser_player: string;
  notes: string;
};

const WINNER_BUTTONS = [
  { value: 'smash_winner', label: 'スマッシュ' },
  { value: 'volley_winner', label: 'ボレー' },
  { value: 'passing_winner', label: 'ストローク' },
  { value: 'drop_winner', label: 'ドロップ' },
  { value: 'net_in_winner', label: 'ネットイン' },
] as const;

const ERROR_BUTTONS = [
  { value: 'net', label: 'ネット' },
  { value: 'out', label: 'アウト' },
  { value: 'smash_error', label: 'スマ失敗' },
  { value: 'volley_error', label: 'ボレ失敗' },
  { value: 'receive_error', label: 'レシーブ失敗' },
  { value: 'follow_error', label: 'フォロー失敗' },
] as const;

const ERROR_RESULT_TYPES = new Set(['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error']);

const createCandidateEditorState = (candidate: MatchPointCandidate | null): CandidateEditorState => ({
  status: candidate?.status ?? 'pending',
  winner_team: candidate?.winner_team ?? null,
  serving_team: candidate?.serving_team ?? null,
  serving_player: candidate?.serving_player ?? '',
  rally_count: candidate?.rally_count ?? 0,
  first_serve_fault: candidate?.first_serve_fault ?? false,
  double_fault: candidate?.double_fault ?? false,
  result_type: candidate?.result_type ?? '',
  winner_player: candidate?.winner_player ?? '',
  loser_player: candidate?.loser_player ?? '',
  notes: candidate?.notes ?? '',
});

const getStatusLabel = (status: MatchPointCandidate['status']) => {
  if (status === 'excluded') return '除外';
  if (status === 'confirmed') return '確定';
  return '未確認';
};

const getPlayerUniqueId = (team: 'A' | 'B', index: number, name: string) => `${team}-${index}-${name}`;

const getTeamFromPlayerId = (uniqueId: string): 'A' | 'B' | null => {
  if (uniqueId.startsWith('A-')) return 'A';
  if (uniqueId.startsWith('B-')) return 'B';
  return null;
};

const determineWinnerTeam = (playerUniqueId: string, resultType: string): 'A' | 'B' | null => {
  if (!playerUniqueId || !resultType) return null;

  const playerTeam = getTeamFromPlayerId(playerUniqueId);
  if (!playerTeam) return null;

  const winnerTypes = new Set(['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace', 'winner']);

  if (winnerTypes.has(resultType)) {
    return playerTeam;
  }

  if (ERROR_RESULT_TYPES.has(resultType)) {
    return playerTeam === 'A' ? 'B' : 'A';
  }

  return null;
};

const getPlayerNamesFromMatch = (match: Match, team: 'A' | 'B'): string[] => {
  if (match.teams?.[team]) {
    return match.teams[team].players.map((player) => `${player.last_name} ${player.first_name}`);
  }

  const players: string[] = [];
  const prefix = `team_${team.toLowerCase()}`;

  const player1LastName = match[`${prefix}_player1_last_name` as keyof Match] as string;
  const player1FirstName = match[`${prefix}_player1_first_name` as keyof Match] as string;

  if (player1LastName && player1FirstName) {
    players.push(`${player1LastName} ${player1FirstName}`);
  }

  const player2LastName = match[`${prefix}_player2_last_name` as keyof Match] as string;
  const player2FirstName = match[`${prefix}_player2_first_name` as keyof Match] as string;

  if (player2LastName && player2FirstName) {
    players.push(`${player2LastName} ${player2FirstName}`);
  }

  if (players.length === 0) {
    const teamString = team === 'A' ? match.team_a : match.team_b;
    if (teamString) {
      const withoutEntryNumber = teamString.replace(/^[A-Za-z0-9]+\s+/, '');
      return withoutEntryNumber
        .split(' / ')
        .map((part) => {
          const playerMatch = part.trim().match(/^([^\(]+)/);
          return playerMatch ? playerMatch[1].trim() : part.trim();
        })
        .filter(Boolean);
    }
  }

  return players;
};

const VideoReviewPage = () => {
  const router = useRouter();
  const { matchId } = router.query;
  const canEditMatches = isDebugMode() && hasLiveMatchApi();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [match, setMatch] = useState<Match | null>(null);
  const [sessions, setSessions] = useState<MatchVideoSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<MatchVideoSession | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateEditor, setCandidateEditor] = useState<CandidateEditorState>(createCandidateEditorState(null));
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [durationMsInput, setDurationMsInput] = useState('');
  const [playerStartSeconds, setPlayerStartSeconds] = useState(0);
  const [localUploadUrl, setLocalUploadUrl] = useState<string | null>(null);
  const [boundUploadSessionId, setBoundUploadSessionId] = useState<string | null>(null);
  const [segmentationConfig, setSegmentationConfig] = useState({
    pointIntervalMs: 12000,
    clipLeadMs: 4000,
    clipTailMs: 9000,
    startOffsetMs: 5000,
  });
  const [sessionForm, setSessionForm] = useState({
    source_type: 'youtube' as 'youtube' | 'upload',
    source_url: '',
    source_label: '',
    upload_file_name: '',
    upload_file_size: 0,
  });

  const selectedCandidates = selectedSession?.candidates ?? [];
  const selectedCandidate = selectedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const confirmedCount = selectedCandidates.filter((candidate) => candidate.status === 'confirmed').length;
  const excludedCount = selectedCandidates.filter((candidate) => candidate.status === 'excluded').length;

  const playerEmbedUrl = useMemo(() => {
    if (!selectedSession || selectedSession.source_type !== 'youtube') return null;
    return buildYouTubeEmbedUrl(selectedSession.source_url ?? selectedSession.youtube_video_id ?? '', playerStartSeconds);
  }, [playerStartSeconds, selectedSession]);

  const canPreviewLocalUpload = selectedSession?.source_type === 'upload' && selectedSession.id === boundUploadSessionId && localUploadUrl;

  const teamAPlayers = useMemo(() => (match ? getPlayerNamesFromMatch(match, 'A') : []), [match]);
  const teamBPlayers = useMemo(() => (match ? getPlayerNamesFromMatch(match, 'B') : []), [match]);

  useEffect(() => {
    return () => {
      if (localUploadUrl) {
        URL.revokeObjectURL(localUploadUrl);
      }
    };
  }, [localUploadUrl]);

  const fetchSession = async (sessionId: string) => {
    if (typeof matchId !== 'string') return;

    setSessionLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/video-sessions/${sessionId}`);
      const data = (await response.json()) as SessionDetailResponse;
      const session = data.session ?? null;
      setSelectedSession(session);
      if (session?.duration_ms) {
        setDurationMsInput(String(session.duration_ms));
      }
      const nextCandidateId =
        selectedCandidateId && session?.candidates?.some((candidate) => candidate.id === selectedCandidateId)
          ? selectedCandidateId
          : (session?.candidates?.[0]?.id ?? null);
      setSelectedCandidateId(nextCandidateId);
      setCandidateEditor(createCandidateEditorState(session?.candidates?.find((candidate) => candidate.id === nextCandidateId) ?? null));
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setSessionLoading(false);
    }
  };

  const fetchMatchAndSessions = async (targetSessionId?: string | null) => {
    if (typeof matchId !== 'string') return;

    setLoading(true);
    try {
      const [matchResponse, sessionsResponse] = await Promise.all([fetch(`/api/matches/${matchId}`), fetch(`/api/matches/${matchId}/video-sessions`)]);

      const matchData = (await matchResponse.json()) as MatchResponse;
      const sessionsData = (await sessionsResponse.json()) as SessionListResponse;
      const nextSessions = sessionsData.sessions ?? [];
      const nextSelectedId = targetSessionId ?? selectedSessionId ?? (nextSessions.length > 0 ? nextSessions[0].id : null);

      setMatch(matchData.match ?? null);
      setSessions(nextSessions);
      setSelectedSessionId(nextSelectedId);

      if (nextSelectedId) {
        await fetchSession(nextSelectedId);
      } else {
        setSelectedSession(null);
        setSelectedCandidateId(null);
        setCandidateEditor(createCandidateEditorState(null));
      }
    } catch (error) {
      console.error('Failed to load video review data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canEditMatches && typeof matchId === 'string') {
      void fetchMatchAndSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditMatches, matchId]);

  const handleSelectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setPlayerStartSeconds(0);
    await fetchSession(sessionId);
  };

  const handleSelectCandidate = (candidate: MatchPointCandidate) => {
    setSelectedCandidateId(candidate.id);
    setCandidateEditor(createCandidateEditorState(candidate));
  };

  const handleUploadFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localUploadUrl) {
      URL.revokeObjectURL(localUploadUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalUploadUrl(objectUrl);
    setSessionForm((current) => ({
      ...current,
      upload_file_name: file.name,
      upload_file_size: file.size,
      source_label: current.source_label || file.name,
    }));
  };

  const handleLocalVideoLoaded = () => {
    if (!videoRef.current) return;
    const durationMs = Math.floor(videoRef.current.duration * 1000);
    if (Number.isFinite(durationMs) && durationMs > 0) {
      setDurationMsInput(String(durationMs));
    }
  };

  const handleCreateSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typeof matchId !== 'string') return;

    const durationMs = Number(durationMsInput) > 0 ? Number(durationMsInput) : null;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/video-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          duration_ms: durationMs,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || '動画セッションの作成に失敗しました。');
        return;
      }

      const createdSession = data.session as MatchVideoSession;
      if (sessionForm.source_type === 'upload' && localUploadUrl) {
        setBoundUploadSessionId(createdSession.id);
      }

      await fetchMatchAndSessions(createdSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('動画セッションの作成中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateCandidates = async () => {
    if (typeof matchId !== 'string' || !selectedSessionId) return;
    if (!durationMsInput || Number(durationMsInput) <= 0) {
      alert('候補生成には動画長さ（ミリ秒）が必要です。');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/video-sessions/${selectedSessionId}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_ms: Number(durationMsInput),
          point_interval_ms: segmentationConfig.pointIntervalMs,
          clip_lead_ms: segmentationConfig.clipLeadMs,
          clip_tail_ms: segmentationConfig.clipTailMs,
          start_offset_ms: segmentationConfig.startOffsetMs,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || '候補生成に失敗しました。');
        return;
      }

      await fetchMatchAndSessions(selectedSessionId);
    } catch (error) {
      console.error('Failed to generate candidates:', error);
      alert('候補生成中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const patchCandidate = async (candidateId: string, updates: Partial<MatchPointCandidate>) => {
    if (typeof matchId !== 'string' || !selectedSessionId) return null;

    const response = await fetch(`/api/matches/${matchId}/video-sessions/${selectedSessionId}/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || '候補の更新に失敗しました。');
      return null;
    }

    const updatedCandidate = data.candidate as MatchPointCandidate;
    setSelectedSession((current) => {
      if (!current) return current;
      return {
        ...current,
        candidates: current.candidates?.map((candidate) => (candidate.id === candidateId ? updatedCandidate : candidate)) ?? [],
      };
    });

    if (selectedCandidateId === candidateId) {
      setCandidateEditor(createCandidateEditorState(updatedCandidate));
    }

    return updatedCandidate;
  };

  const handleQuickStatusUpdate = async (candidate: MatchPointCandidate, updates: Partial<MatchPointCandidate>) => {
    try {
      await patchCandidate(candidate.id, updates);
    } catch (error) {
      console.error('Failed to quick update candidate:', error);
      alert('候補更新中にエラーが発生しました。');
    }
  };

  const handleCommit = async () => {
    if (typeof matchId !== 'string' || !selectedSessionId) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/video-sessions/${selectedSessionId}/commit`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || '既存ポイントへの反映に失敗しました。');
        return;
      }

      router.push(`/beta/matches/${matchId}/input`);
    } catch (error) {
      console.error('Failed to commit candidates:', error);
      alert('反映中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const updateEditor = (updates: Partial<CandidateEditorState>) => {
    setCandidateEditor((current) => ({ ...current, ...updates }));
  };

  const handleResultTypeSelect = (resultType: string) => {
    const nextState: CandidateEditorState = {
      ...candidateEditor,
      result_type: resultType,
      double_fault: resultType === 'double_fault',
      first_serve_fault: resultType === 'double_fault' ? true : candidateEditor.first_serve_fault,
      rally_count: resultType === 'receive_error' ? 2 : resultType === 'service_ace' || resultType === 'double_fault' ? 1 : candidateEditor.rally_count,
    };

    const pivotPlayer = ERROR_RESULT_TYPES.has(resultType) ? nextState.loser_player : nextState.winner_player;
    const autoWinner = pivotPlayer ? determineWinnerTeam(pivotPlayer, resultType) : null;

    if (autoWinner) {
      nextState.winner_team = autoWinner;
      if (!nextState.serving_team && resultType === 'service_ace') {
        nextState.serving_team = autoWinner;
      }
      if (!nextState.serving_team && resultType === 'double_fault') {
        nextState.serving_team = autoWinner === 'A' ? 'B' : 'A';
      }
    }

    updateEditor(nextState);
  };

  const handlePlayerSelect = (uniqueId: string, team: 'A' | 'B', kind: 'winner' | 'loser') => {
    const nextState = { ...candidateEditor };
    if (kind === 'winner') {
      nextState.winner_player = uniqueId;
      if (nextState.loser_player === uniqueId) {
        nextState.loser_player = '';
      }
    } else {
      nextState.loser_player = uniqueId;
      if (nextState.winner_player === uniqueId) {
        nextState.winner_player = '';
      }
    }

    if (nextState.result_type) {
      const pivotPlayer = ERROR_RESULT_TYPES.has(nextState.result_type) ? nextState.loser_player : nextState.winner_player;
      const autoWinner = pivotPlayer ? determineWinnerTeam(pivotPlayer, nextState.result_type) : null;
      if (autoWinner) {
        nextState.winner_team = autoWinner;
      }
    } else if (kind === 'winner') {
      nextState.winner_team = team;
    }

    updateEditor(nextState);
  };

  const handleServingTeamChange = (team: 'A' | 'B' | null) => {
    updateEditor({
      serving_team: team,
      serving_player:
        team === null
          ? ''
          : candidateEditor.serving_player && getTeamFromPlayerId(candidateEditor.serving_player) === team
            ? candidateEditor.serving_player
            : '',
    });
  };

  const handleSaveCandidate = async () => {
    if (!selectedCandidate) return;

    setSavingCandidate(true);
    try {
      await patchCandidate(selectedCandidate.id, {
        status: candidateEditor.status ?? 'pending',
        winner_team: candidateEditor.winner_team,
        serving_team: candidateEditor.serving_team,
        serving_player: candidateEditor.serving_player || null,
        rally_count: candidateEditor.rally_count || null,
        first_serve_fault: candidateEditor.first_serve_fault,
        double_fault: candidateEditor.double_fault,
        result_type: candidateEditor.result_type || null,
        winner_player: candidateEditor.winner_player || null,
        loser_player: candidateEditor.loser_player || null,
        notes: candidateEditor.notes || null,
      });
    } catch (error) {
      console.error('Failed to save candidate:', error);
      alert('候補保存中にエラーが発生しました。');
    } finally {
      setSavingCandidate(false);
    }
  };

  if (isScoreSiteMode()) {
    return <Error statusCode={404} />;
  }

  if (!canEditMatches) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">編集不可</strong>
          <span className="block sm:inline ml-2">このページは開発サーバーでのみ利用できます。</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!match) {
    return <div className="p-6">Match not found</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/beta/matches/${match.id}`} className="text-blue-600 hover:underline">
          ← マッチ詳細に戻る
        </Link>
        <Link href={`/beta/matches/${match.id}/input`} className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">
          通常入力へ
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-md">
        <h1 className="mb-2 text-2xl font-bold">動画補助スコア入力</h1>
        <p className="mb-1 text-gray-600">
          {match.team_a} vs {match.team_b}
        </p>
        <p className="text-sm text-gray-500">
          候補精度を上げるため、ポイント間隔や切り出し余白を調整できるようにしました。大きい画面では動画を固定し、候補リストだけをスクロールできます。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="rounded-lg bg-white p-5 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">動画セッション作成</h2>
            <form className="space-y-4" onSubmit={handleCreateSession}>
              <div>
                <label className="mb-1 block text-sm text-gray-700">入力元</label>
                <select
                  value={sessionForm.source_type}
                  onChange={(event) =>
                    setSessionForm((current) => ({
                      ...current,
                      source_type: event.target.value as 'youtube' | 'upload',
                    }))
                  }
                  className="w-full rounded border p-2 text-sm"
                >
                  <option value="youtube">YouTube</option>
                  <option value="upload">ローカル動画</option>
                </select>
              </div>

              {sessionForm.source_type === 'youtube' ? (
                <div>
                  <label className="mb-1 block text-sm text-gray-700">YouTube URL</label>
                  <input
                    type="url"
                    value={sessionForm.source_url}
                    onChange={(event) =>
                      setSessionForm((current) => ({
                        ...current,
                        source_url: event.target.value,
                      }))
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded border p-2 text-sm"
                    required
                  />
                  {sessionForm.source_url && !parseYouTubeVideoId(sessionForm.source_url) && (
                    <p className="mt-1 text-xs text-red-500">動画IDを読み取れないURLです。</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm text-gray-700">ローカル動画</label>
                  <input type="file" accept="video/*" onChange={handleUploadFileChange} className="w-full rounded border p-2 text-sm" />
                  <p className="mt-1 text-xs text-gray-500">MVPではローカル再生用です。再訪時は再選択が必要です。</p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-gray-700">ラベル</label>
                <input
                  type="text"
                  value={sessionForm.source_label}
                  onChange={(event) =>
                    setSessionForm((current) => ({
                      ...current,
                      source_label: event.target.value,
                    }))
                  }
                  placeholder="例: 2026春 関東予選 1回戦"
                  className="w-full rounded border p-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-700">動画長さ (ms)</label>
                <input
                  type="number"
                  min="1"
                  value={durationMsInput}
                  onChange={(event) => setDurationMsInput(event.target.value)}
                  placeholder="例: 1800000"
                  className="w-full rounded border p-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
              >
                {submitting ? '作成中...' : 'セッションを作成'}
              </button>
            </form>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">既存セッション</h2>
              <span className="text-xs text-gray-500">{sessions.length} 件</span>
            </div>
            <div className="space-y-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void handleSelectSession(session.id)}
                  className={`w-full rounded border p-3 text-left ${
                    selectedSessionId === session.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{session.source_label || '無題セッション'}</span>
                    <span className="text-xs text-gray-500">{session.source_type === 'youtube' ? 'YouTube' : 'ローカル動画'}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {session.duration_ms ? formatDurationLabel(session.duration_ms) : '動画長未設定'}
                    {' · '}
                    {session.processing_status || 'draft'}
                  </div>
                </button>
              ))}
              {sessions.length === 0 && <p className="text-sm text-gray-500">まだ動画セッションがありません。</p>}
            </div>
          </div>

          {selectedSession && (
            <div className="rounded-lg bg-white p-5 shadow-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">候補生成設定</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded bg-green-50 px-3 py-1 text-green-700">確定 {confirmedCount}</span>
                  <span className="rounded bg-gray-100 px-3 py-1 text-gray-700">除外 {excludedCount}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">予測ポイント間隔 (ms)</label>
                  <input
                    type="number"
                    min="6000"
                    step="1000"
                    value={segmentationConfig.pointIntervalMs}
                    onChange={(event) =>
                      setSegmentationConfig((current) => ({
                        ...current,
                        pointIntervalMs: Number(event.target.value) || 12000,
                      }))
                    }
                    className="w-full rounded border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">前余白 (ms)</label>
                  <input
                    type="number"
                    min="1500"
                    step="500"
                    value={segmentationConfig.clipLeadMs}
                    onChange={(event) =>
                      setSegmentationConfig((current) => ({
                        ...current,
                        clipLeadMs: Number(event.target.value) || 4000,
                      }))
                    }
                    className="w-full rounded border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">後余白 (ms)</label>
                  <input
                    type="number"
                    min="4000"
                    step="500"
                    value={segmentationConfig.clipTailMs}
                    onChange={(event) =>
                      setSegmentationConfig((current) => ({
                        ...current,
                        clipTailMs: Number(event.target.value) || 9000,
                      }))
                    }
                    className="w-full rounded border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">開始オフセット (ms)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={segmentationConfig.startOffsetMs}
                    onChange={(event) =>
                      setSegmentationConfig((current) => ({
                        ...current,
                        startOffsetMs: Number(event.target.value) || 0,
                      }))
                    }
                    className="w-full rounded border p-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateCandidates()}
                  disabled={submitting || sessionLoading}
                  className="w-full rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {submitting ? '処理中...' : '候補を再生成'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCommit()}
                  disabled={submitting || selectedCandidates.length === 0}
                  className="w-full rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  確定候補を既存スコアへ反映
                </button>
                <p className="text-xs text-gray-500">
                  {selectedSession.duration_ms ? `動画長 ${formatDurationLabel(selectedSession.duration_ms)}` : '動画長未設定'}
                </p>
              </div>
            </div>
          )}
        </aside>

        <main>
          {selectedSession ? (
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-5 shadow-md">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{selectedSession.source_label || '無題セッション'}</h2>
                  <p className="text-sm text-gray-500">{selectedSession.source_type === 'youtube' ? 'YouTube 埋め込み再生' : 'ローカル動画プレビュー'}</p>
                </div>

                <div className="mb-4 overflow-hidden rounded-lg bg-black">
                  {selectedSession.source_type === 'youtube' && playerEmbedUrl ? (
                    <iframe
                      key={`${selectedSession.id}-${playerStartSeconds}`}
                      src={playerEmbedUrl}
                      title="YouTube player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="aspect-video w-full"
                    />
                  ) : canPreviewLocalUpload ? (
                    <video
                      key={localUploadUrl}
                      ref={videoRef}
                      src={localUploadUrl ?? undefined}
                      controls
                      onLoadedMetadata={handleLocalVideoLoaded}
                      className="aspect-video w-full"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-gray-300">
                      {selectedSession.source_type === 'upload'
                        ? 'このローカル動画は再アタッチが必要です。左側で同じ動画を再選択してください。'
                        : 'プレビューできる動画URLがありません。'}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
                <section className="rounded-lg bg-white p-5 shadow-md">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">ポイント候補一覧</h2>
                    <span className="text-sm text-gray-500">{selectedCandidates.length} 件</span>
                  </div>

                  {sessionLoading ? (
                    <div className="py-8 text-center text-gray-500">セッションを読み込み中...</div>
                  ) : selectedCandidates.length === 0 ? (
                    <div className="rounded border border-dashed p-8 text-center text-sm text-gray-500">
                      まだ候補がありません。上の設定を調整して候補を再生成してください。
                    </div>
                  ) : (
                    <div className="space-y-3 lg:max-h-[calc(100vh-26rem)] lg:overflow-y-auto lg:pr-2">
                      {selectedCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => handleSelectCandidate(candidate)}
                          className={`w-full rounded-lg border p-4 text-left ${
                            selectedCandidateId === candidate.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-medium">候補 #{candidate.candidate_order}</span>
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{getStatusLabel(candidate.status)}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDurationLabel(candidate.start_ms)} - {formatDurationLabel(candidate.end_ms)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span
                              className={`rounded px-2 py-1 ${
                                (candidate.confidence ?? 0) < 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {getConfidenceLabel(candidate.confidence)}
                            </span>
                            {candidate.winner_team && <span className="rounded bg-white px-2 py-1 text-gray-700">得点: {candidate.winner_team}</span>}
                            {candidate.result_type && <span className="rounded bg-white px-2 py-1 text-gray-700">{candidate.result_type}</span>}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleQuickStatusUpdate(candidate, {
                                  status: 'confirmed',
                                  winner_team: 'A',
                                });
                              }}
                              className="cursor-pointer rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                            >
                              A得点
                            </span>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleQuickStatusUpdate(candidate, {
                                  status: 'confirmed',
                                  winner_team: 'B',
                                });
                              }}
                              className="cursor-pointer rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                            >
                              B得点
                            </span>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleQuickStatusUpdate(candidate, {
                                  status: 'excluded',
                                  winner_team: null,
                                });
                              }}
                              className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                            >
                              除外
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg bg-white p-5 shadow-md">
                  {selectedCandidate ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">候補 #{selectedCandidate.candidate_order} を編集</h2>
                          <p className="text-sm text-gray-500">
                            {formatDurationLabel(selectedCandidate.start_ms)} - {formatDurationLabel(selectedCandidate.end_ms)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPlayerStartSeconds(Math.max(0, Math.floor(selectedCandidate.start_ms / 1000)));
                            if (videoRef.current) {
                              videoRef.current.currentTime = selectedCandidate.start_ms / 1000;
                              void videoRef.current.play().catch(() => undefined);
                            }
                          }}
                          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
                        >
                          この位置から再生
                        </button>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">候補状態</h3>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            { value: 'confirmed', label: '確定' },
                            { value: 'pending', label: '未確認' },
                            { value: 'excluded', label: '除外' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                updateEditor({
                                  status: option.value as CandidateEditorState['status'],
                                })
                              }
                              className={`rounded border-2 px-3 py-2 text-sm ${
                                candidateEditor.status === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">サーブ情報</h3>
                        <div className="grid gap-2 md:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => {
                              const servingTeam = candidateEditor.serving_team ?? 'A';
                              const servingPlayer = candidateEditor.serving_player;
                              updateEditor({
                                result_type: 'service_ace',
                                serving_team: servingTeam,
                                winner_team: servingTeam,
                                winner_player: servingPlayer,
                                loser_player: '',
                                rally_count: 1,
                                double_fault: false,
                              });
                            }}
                            className={`rounded border-2 p-2 text-xs font-medium ${
                              candidateEditor.result_type === 'service_ace'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-gray-300 hover:border-green-300'
                            }`}
                          >
                            サービスエース
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateEditor({
                                first_serve_fault: !candidateEditor.first_serve_fault,
                              })
                            }
                            className={`rounded border-2 p-2 text-xs font-medium ${
                              candidateEditor.first_serve_fault ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 hover:border-orange-300'
                            }`}
                          >
                            1stフォルト
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const servingTeam = candidateEditor.serving_team ?? 'A';
                              const servingPlayer = candidateEditor.serving_player;
                              updateEditor({
                                result_type: 'double_fault',
                                double_fault: true,
                                first_serve_fault: true,
                                winner_team: servingTeam === 'A' ? 'B' : 'A',
                                loser_player: servingPlayer,
                                winner_player: '',
                                rally_count: 1,
                              });
                            }}
                            className={`rounded border-2 p-2 text-xs font-medium ${
                              candidateEditor.result_type === 'double_fault'
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-gray-300 hover:border-purple-300'
                            }`}
                          >
                            ダブルフォルト
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">ラリー数</h3>
                        <div className="overflow-x-auto">
                          <div className="flex gap-1 pb-2" style={{ minWidth: 'max-content' }}>
                            {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => updateEditor({ rally_count: count })}
                                className={`h-8 w-8 flex-shrink-0 rounded border-2 text-xs font-medium ${
                                  candidateEditor.rally_count === count
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-300 hover:border-indigo-300'
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h3 className="mb-2 text-sm font-medium text-green-600">ウィナー</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {WINNER_BUTTONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleResultTypeSelect(option.value)}
                                className={`rounded border-2 p-2 text-xs font-medium ${
                                  candidateEditor.result_type === option.value
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-gray-300 hover:border-green-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-2 text-sm font-medium text-red-600">ミス</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {ERROR_BUTTONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleResultTypeSelect(option.value)}
                                className={`rounded border-2 p-2 text-xs font-medium ${
                                  candidateEditor.result_type === option.value
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-300 hover:border-red-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs text-gray-600">サーブ側</label>
                          <select
                            value={candidateEditor.serving_team ?? ''}
                            onChange={(event) => handleServingTeamChange(event.target.value ? (event.target.value as 'A' | 'B') : null)}
                            className="w-full rounded border p-2 text-sm"
                          >
                            <option value="">未設定</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-600">結果種別</label>
                          <select
                            value={candidateEditor.result_type}
                            onChange={(event) => handleResultTypeSelect(event.target.value)}
                            className="w-full rounded border p-2 text-sm"
                          >
                            {VIDEO_REVIEW_RESULT_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-600">勝者チーム</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateEditor({ winner_team: 'A' })}
                              className={`rounded border-2 p-2 text-sm ${
                                candidateEditor.winner_team === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              チーム A
                            </button>
                            <button
                              type="button"
                              onClick={() => updateEditor({ winner_team: 'B' })}
                              className={`rounded border-2 p-2 text-sm ${
                                candidateEditor.winner_team === 'B' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
                              }`}
                            >
                              チーム B
                            </button>
                          </div>
                        </div>
                      </div>

                      {candidateEditor.serving_team && (
                        <div>
                          <h3 className="mb-2 text-sm font-medium">サーブ選手</h3>
                          <div className="grid gap-2 md:grid-cols-2">
                            {(candidateEditor.serving_team === 'A' ? teamAPlayers : teamBPlayers).map((playerName, index) => {
                              const uniqueId = getPlayerUniqueId(candidateEditor.serving_team as 'A' | 'B', index, playerName);
                              return (
                                <button
                                  key={uniqueId}
                                  type="button"
                                  onClick={() => updateEditor({ serving_player: uniqueId })}
                                  className={`rounded border-2 p-2 text-sm ${
                                    candidateEditor.serving_player === uniqueId
                                      ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                                      : 'border-gray-300 hover:border-yellow-300'
                                  }`}
                                >
                                  {playerName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="mb-2 text-sm font-medium">関与選手</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="mb-2 text-xs font-medium text-blue-600">チーム A</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {teamAPlayers.map((playerName, index) => {
                                const uniqueId = getPlayerUniqueId('A', index, playerName);
                                return (
                                  <button
                                    key={uniqueId}
                                    type="button"
                                    onClick={() => handlePlayerSelect(uniqueId, 'A', ERROR_RESULT_TYPES.has(candidateEditor.result_type) ? 'loser' : 'winner')}
                                    className={`rounded border-2 p-2 text-xs ${
                                      candidateEditor.winner_player === uniqueId
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : candidateEditor.loser_player === uniqueId
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

                          <div>
                            <h4 className="mb-2 text-xs font-medium text-red-600">チーム B</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {teamBPlayers.map((playerName, index) => {
                                const uniqueId = getPlayerUniqueId('B', index, playerName);
                                return (
                                  <button
                                    key={uniqueId}
                                    type="button"
                                    onClick={() => handlePlayerSelect(uniqueId, 'B', ERROR_RESULT_TYPES.has(candidateEditor.result_type) ? 'loser' : 'winner')}
                                    className={`rounded border-2 p-2 text-xs ${
                                      candidateEditor.winner_player === uniqueId
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : candidateEditor.loser_player === uniqueId
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

                      <div>
                        <label className="mb-1 block text-xs text-gray-600">メモ</label>
                        <textarea
                          value={candidateEditor.notes}
                          onChange={(event) => updateEditor({ notes: event.target.value })}
                          rows={3}
                          className="w-full rounded border p-2 text-sm"
                          placeholder="この候補に関する補足"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSaveCandidate()}
                          disabled={savingCandidate}
                          className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          {savingCandidate ? '保存中...' : '候補内容を保存'}
                        </button>
                        <div className="text-sm text-gray-500">得点者、サーブ、ラリー数、結果種別、関与選手を通常入力に近い形で調整できます。</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">左の候補一覧から編集したい候補を選んでください。</div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-10 text-center text-gray-500 shadow-md">左側で動画セッションを作成または選択してください。</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default VideoReviewPage;
