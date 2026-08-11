import Error from 'next/error';
import Link from 'next/link';

import { getPlayerNamesFromMatch } from '../../../../../lib/matchLogic';
import { isScoreSiteMode } from '../../../../../lib/siteConfig';
import { determineInitialServeTeam } from '../../../../../lib/serveHelpers';
import DevOnlyNotice from '../../../../components/matches/DevOnlyNotice';
import DesktopVideoSidebar from '../../../../components/matches/matchInput/DesktopVideoSidebar';
import GameHistorySection from '../../../../components/matches/matchInput/GameHistorySection';
import GameScoreSummaryPanel from '../../../../components/matches/matchInput/GameScoreSummaryPanel';
import LastPointQuickEdit from '../../../../components/matches/matchInput/LastPointQuickEdit';
import MatchInfoPanel from '../../../../components/matches/matchInput/MatchInfoPanel';
import PointInputForm from '../../../../components/matches/matchInput/PointInputForm';
import { useMatchInputController } from '../../../../components/matches/matchInput/useMatchInputController';
import ServeSelection from '../../../../components/ServeSelection';

const MatchInput = () => {
  const scoreSiteMode = isScoreSiteMode();
  const {
    canEditMatches,
    loading,
    match,
    currentGame,
    initialServeTeam,
    needsServeSelection,
    isEditMode,
    editingPoint,
    submitting,
    manualServingPlayer,
    setManualServingPlayer,
    matchMetadata,
    setMatchMetadata,
    metadataSaving,
    updateMatchMetadata,
    youtubeEmbedBlocked,
    setYoutubeEmbedBlocked,
    mobileYoutubePlayerRef,
    desktopYoutubePlayerRef,
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
    pointData,
    setPointData,
    pointInferenceContext,
    selectServiceAce,
    selectDoubleFault,
    toggleFirstServeFault,
    submitPoint,
    updatePoint,
    startEditPoint,
    cancelEditPoint,
    lastRecordedPoint,
    lastRecordedPointGame,
    canEditLastRecordedPoint,
    startEditLastRecordedPoint,
    startNewGame,
    startFirstGame,
    restartFromGame,
    handleServeTeamSelected,
    getCurrentServe,
    getCurrentServingPlayer,
    getServingPlayerForPoint,
    getGameScores,
    currentScore,
    gameWon,
    matchFinished,
    matchWinner,
    isPointInputActive,
    sortedGames,
  } = useMatchInputController();

  if (scoreSiteMode) {
    return <Error statusCode={404} />;
  }

  // 開発環境でない場合はアクセス拒否
  if (!canEditMatches) {
    return <DevOnlyNotice title="編集不可" message="このページは開発サーバーでのみ利用できます。静的公開環境では閲覧用の詳細ページをご利用ください。" />;
  }

  if (loading) return <div>Loading...</div>;
  if (!match) return <div>Match not found</div>;

  const gameScores = getGameScores();

  // 直前ポイントのクイック修正カード。編集モード中は編集対象と紛らわしいので出さない。
  const lastPointQuickEdit =
    !isEditMode && lastRecordedPoint && lastRecordedPointGame ? (
      <LastPointQuickEdit
        lastPoint={lastRecordedPoint}
        lastPointGame={lastRecordedPointGame}
        canEdit={canEditLastRecordedPoint}
        onEditLastPoint={startEditLastRecordedPoint}
      />
    ) : null;

  const gameHistorySection = (
    <GameHistorySection
      sortedGames={sortedGames}
      currentGame={currentGame}
      canEditMatches={canEditMatches}
      isPointInputActive={isPointInputActive}
      activeYouTubeVideoId={activeYouTubeVideoId}
      youtubeEmbedBlocked={youtubeEmbedBlocked}
      submitting={submitting}
      onEditPoint={startEditPoint}
      onJumpToPointVideo={jumpToPointVideo}
      onRestartFromGame={restartFromGame}
      getServingPlayerForPoint={getServingPlayerForPoint}
    />
  );

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

      <MatchInfoPanel
        match={match}
        matchMetadata={matchMetadata}
        setMatchMetadata={setMatchMetadata}
        metadataSaving={metadataSaving}
        onSaveMetadata={updateMatchMetadata}
        youtubeEmbedBlocked={youtubeEmbedBlocked}
        setYoutubeEmbedBlocked={setYoutubeEmbedBlocked}
        activeYouTubeVideoId={activeYouTubeVideoId}
        showDesktopVideoLayout={showDesktopVideoLayout}
        mobileYoutubePlayerRef={mobileYoutubePlayerRef}
        onReady={() => restorePendingVideoPlayback('mobile')}
        onResume={resumeVideoPlayback}
        onPause={pauseVideoPlayback}
      />

      {/* 試合終了表示 */}
      {matchFinished && matchWinner && (
        <div className="bg-green-100 border border-green-400 rounded-lg p-6 mb-6 text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-2">試合終了！</h2>
          <p className="text-xl text-green-700">{matchWinner === 'A' ? match.team_a : match.team_b} の勝利！</p>
          <p className="text-green-600 mt-2">ゲームスコア: {gameScores}</p>
        </div>
      )}

      {/* サーブ権選択 */}
      {needsServeSelection && currentGame && (
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
          <DesktopVideoSidebar
            activeYouTubeVideoId={activeYouTubeVideoId}
            playerRef={desktopYoutubePlayerRef}
            onReady={() => restorePendingVideoPlayback('desktop')}
            youtubeEmbedBlocked={youtubeEmbedBlocked}
            youtubeUrl={matchMetadata.youtube_url}
            onEmbedBlocked={() => {
              setYoutubeEmbedBlocked(true);
              setMatchMetadata((current) => ({
                ...current,
                youtube_embed_allowed: false,
              }));
            }}
            onResume={resumeVideoPlayback}
            onPause={pauseVideoPlayback}
            pointData={pointData}
            setPointData={setPointData}
            getVideoStartInput={getVideoStartInput}
            getVideoEndInput={getVideoEndInput}
            currentGame={currentGame}
            gameScores={gameScores}
            currentScore={currentScore}
            getCurrentServe={getCurrentServe}
            getCurrentServingPlayer={getCurrentServingPlayer}
            gameWon={gameWon}
            matchFinished={matchFinished}
            onStartNewGame={startNewGame}
          />
        )}

        {/* ゲームスコアと現在のゲーム状況を横並びで表示 */}
        {!matchFinished && !needsServeSelection && currentGame && (
          <GameScoreSummaryPanel
            match={match}
            currentGame={currentGame}
            isPointInputActive={isPointInputActive}
            currentScore={currentScore}
            gameScores={gameScores}
            gameWon={gameWon}
            matchFinished={matchFinished}
            getCurrentServe={getCurrentServe}
            onStartNewGame={startNewGame}
          />
        )}

        {/* ポイント入力フォーム */}
        {isPointInputActive && currentGame && (
          <div className="xl:col-start-2 xl:row-start-1">
            {lastPointQuickEdit}

            <PointInputForm
              match={match}
              isEditMode={isEditMode}
              editingPoint={editingPoint}
              submitting={submitting}
              pointData={pointData}
              setPointData={setPointData}
              pointInferenceContext={pointInferenceContext}
              manualServingPlayer={manualServingPlayer}
              setManualServingPlayer={setManualServingPlayer}
              activeYouTubeVideoId={activeYouTubeVideoId}
              youtubeEmbedBlocked={youtubeEmbedBlocked}
              getVideoStartInput={getVideoStartInput}
              getVideoEndInput={getVideoEndInput}
              onCaptureVideoTime={captureVideoTime}
              onClearVideoRange={clearVideoRange}
              onSelectServiceAce={selectServiceAce}
              onSelectDoubleFault={selectDoubleFault}
              onToggleFirstServeFault={toggleFirstServeFault}
              onSubmitPoint={submitPoint}
              onUpdatePoint={updatePoint}
              onCancelEditPoint={cancelEditPoint}
            />

            {gameHistorySection}
          </div>
        )}

        {!isPointInputActive && (
          <>
            {/* サーブ権選択待ち・ゲーム終了待ちなど、入力フォームが出ていない状態でも
                直前ポイント（＝そのゲームを決めたポイント）は修正できるようにする。 */}
            {lastPointQuickEdit}
            {gameHistorySection}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchInput;
