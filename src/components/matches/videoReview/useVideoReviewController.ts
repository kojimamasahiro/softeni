import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { hasLiveMatchApi } from '../../../../lib/betaMatchesClient';
import { isDebugMode } from '../../../../lib/env';
import { determineWinnerTeam, getPlayerNamesFromMatch, getTeamFromPlayerId } from '../../../../lib/matchLogic';
import { buildYouTubeEmbedUrl } from '../../../../lib/videoReview';
import type { Match, MatchPointCandidate, MatchVideoSession } from '../../../types/database';
import { createCandidateEditorState, ERROR_RESULT_TYPES, type CandidateEditorState, type SegmentationConfigState, type SessionFormState } from './types';

type SessionListResponse = {
  sessions?: MatchVideoSession[];
};

type SessionDetailResponse = {
  session?: MatchVideoSession | null;
};

type MatchResponse = {
  match?: Match | null;
};

/**
 * `/beta/matches/[matchId]/video-review` の状態管理とAPI連携をまとめたフック。
 * ページ側は本フックが返す値をそのまま各サブコンポーネントへ渡す。
 */
export const useVideoReviewController = () => {
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
  const [segmentationConfig, setSegmentationConfig] = useState<SegmentationConfigState>({
    pointIntervalMs: 12000,
    clipLeadMs: 4000,
    clipTailMs: 9000,
    startOffsetMs: 5000,
  });
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    source_type: 'youtube',
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

  const canPreviewLocalUpload = Boolean(selectedSession?.source_type === 'upload' && selectedSession.id === boundUploadSessionId && localUploadUrl);

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

  return {
    // アクセス制御・読み込み状態
    canEditMatches,
    loading,
    match,

    // セッション
    sessions,
    selectedSessionId,
    selectedSession,
    sessionLoading,
    sessionForm,
    setSessionForm,
    durationMsInput,
    setDurationMsInput,
    handleUploadFileChange,
    handleLocalVideoLoaded,
    handleCreateSession,
    handleSelectSession,
    submitting,

    // 動画再生
    videoRef,
    playerEmbedUrl,
    playerStartSeconds,
    setPlayerStartSeconds,
    canPreviewLocalUpload,
    localUploadUrl,

    // 候補生成
    segmentationConfig,
    setSegmentationConfig,
    handleGenerateCandidates,
    handleCommit,
    confirmedCount,
    excludedCount,

    // 候補一覧・編集
    selectedCandidates,
    selectedCandidate,
    selectedCandidateId,
    handleSelectCandidate,
    handleQuickStatusUpdate,
    candidateEditor,
    updateEditor,
    handleResultTypeSelect,
    handlePlayerSelect,
    handleServingTeamChange,
    handleSaveCandidate,
    savingCandidate,
    teamAPlayers,
    teamBPlayers,
  };
};
