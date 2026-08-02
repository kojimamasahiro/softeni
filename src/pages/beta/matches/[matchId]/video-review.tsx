import Error from 'next/error';
import Link from 'next/link';

import { isScoreSiteMode } from '../../../../../lib/siteConfig';
import CandidateEditorPanel from '../../../../components/matches/videoReview/CandidateEditorPanel';
import CandidateGenerationPanel from '../../../../components/matches/videoReview/CandidateGenerationPanel';
import CandidateListPanel from '../../../../components/matches/videoReview/CandidateListPanel';
import { useVideoReviewController } from '../../../../components/matches/videoReview/useVideoReviewController';
import VideoPlayerPanel from '../../../../components/matches/videoReview/VideoPlayerPanel';
import VideoSessionForm from '../../../../components/matches/videoReview/VideoSessionForm';
import VideoSessionList from '../../../../components/matches/videoReview/VideoSessionList';
import DevOnlyNotice from '../../../../components/matches/DevOnlyNotice';

const VideoReviewPage = () => {
  const {
    canEditMatches,
    loading,
    match,
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
    videoRef,
    playerEmbedUrl,
    playerStartSeconds,
    setPlayerStartSeconds,
    canPreviewLocalUpload,
    localUploadUrl,
    segmentationConfig,
    setSegmentationConfig,
    handleGenerateCandidates,
    handleCommit,
    confirmedCount,
    excludedCount,
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
  } = useVideoReviewController();

  if (isScoreSiteMode()) {
    return <Error statusCode={404} />;
  }

  if (!canEditMatches) {
    return <DevOnlyNotice title="編集不可" message="このページは開発サーバーでのみ利用できます。" />;
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!match) {
    return <div className="p-6">Match not found</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
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
          <VideoSessionForm
            sessionForm={sessionForm}
            onSessionFormChange={setSessionForm}
            durationMsInput={durationMsInput}
            onDurationMsInputChange={setDurationMsInput}
            submitting={submitting}
            onUploadFileChange={handleUploadFileChange}
            onSubmit={handleCreateSession}
          />

          <VideoSessionList sessions={sessions} selectedSessionId={selectedSessionId} onSelectSession={(sessionId) => void handleSelectSession(sessionId)} />

          {selectedSession && (
            <CandidateGenerationPanel
              selectedSession={selectedSession}
              confirmedCount={confirmedCount}
              excludedCount={excludedCount}
              selectedCandidatesLength={selectedCandidates.length}
              segmentationConfig={segmentationConfig}
              onSegmentationConfigChange={setSegmentationConfig}
              submitting={submitting}
              sessionLoading={sessionLoading}
              onGenerateCandidates={() => void handleGenerateCandidates()}
              onCommit={() => void handleCommit()}
            />
          )}
        </aside>

        <main>
          {selectedSession ? (
            <div className="space-y-6">
              <VideoPlayerPanel
                selectedSession={selectedSession}
                playerEmbedUrl={playerEmbedUrl}
                playerStartSeconds={playerStartSeconds}
                canPreviewLocalUpload={Boolean(canPreviewLocalUpload)}
                localUploadUrl={localUploadUrl}
                videoRef={videoRef}
                onLocalVideoLoaded={handleLocalVideoLoaded}
              />

              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
                <CandidateListPanel
                  selectedCandidates={selectedCandidates}
                  selectedCandidateId={selectedCandidateId}
                  sessionLoading={sessionLoading}
                  onSelectCandidate={handleSelectCandidate}
                  onQuickStatusUpdate={(candidate, updates) => void handleQuickStatusUpdate(candidate, updates)}
                />

                <section className="rounded-lg bg-white p-5 shadow-md">
                  <CandidateEditorPanel
                    selectedCandidate={selectedCandidate}
                    candidateEditor={candidateEditor}
                    updateEditor={updateEditor}
                    handleResultTypeSelect={handleResultTypeSelect}
                    handlePlayerSelect={handlePlayerSelect}
                    handleServingTeamChange={handleServingTeamChange}
                    teamAPlayers={teamAPlayers}
                    teamBPlayers={teamBPlayers}
                    savingCandidate={savingCandidate}
                    onSaveCandidate={() => void handleSaveCandidate()}
                    videoRef={videoRef}
                    setPlayerStartSeconds={setPlayerStartSeconds}
                  />
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
