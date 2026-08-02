import type { Dispatch, SetStateAction } from 'react';

import { determineWinnerTeam, ERROR_BUTTONS, ERROR_RESULT_TYPES, getPlayerNamesFromMatch, getPlayerUniqueId, WINNER_BUTTONS } from '../../../../lib/matchLogic';
import type { Match, Point } from '../../../types/database';
import type { ManualServingPlayer, PointDataState, ServingPlayerInfo } from './types';
import VideoTimeRangeInputs from './VideoTimeRangeInputs';

type PointInputFormProps = {
  match: Match;
  isEditMode: boolean;
  editingPoint: Point | null;
  submitting: boolean;
  pointData: PointDataState;
  setPointData: Dispatch<SetStateAction<PointDataState>>;
  manualServingPlayer: ManualServingPlayer;
  setManualServingPlayer: Dispatch<SetStateAction<ManualServingPlayer>>;
  getCurrentServe: () => 'A' | 'B' | null;
  getCurrentServingPlayer: () => ServingPlayerInfo;
  isPointInputActive: boolean;
  activeYouTubeVideoId: string | null;
  youtubeEmbedBlocked: boolean;
  getVideoStartInput: () => string;
  getVideoEndInput: () => string;
  onCaptureVideoTime: (target: 'start' | 'end') => void;
  onClearVideoRange: () => void;
  onSubmitPoint: () => void;
  onUpdatePoint: () => void;
  onCancelEditPoint: () => void;
};

const PointInputForm = ({
  match,
  isEditMode,
  editingPoint,
  submitting,
  pointData,
  setPointData,
  manualServingPlayer,
  setManualServingPlayer,
  getCurrentServe,
  getCurrentServingPlayer,
  isPointInputActive,
  activeYouTubeVideoId,
  youtubeEmbedBlocked,
  getVideoStartInput,
  getVideoEndInput,
  onCaptureVideoTime,
  onClearVideoRange,
  onSubmitPoint,
  onUpdatePoint,
  onCancelEditPoint,
}: PointInputFormProps) => {
  const servingPlayer = getCurrentServingPlayer();

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">{isEditMode ? 'ポイント編集' : 'ポイント記録'}</h3>
        {isEditMode && editingPoint && <p className="text-sm text-blue-600 mt-1">#{editingPoint.point_number} を編集中</p>}
        {!isEditMode && servingPlayer && (
          <div className="mt-2">
            {(() => {
              const currentServingTeam = getCurrentServe();
              if (!currentServingTeam) return null;

              const teamPlayers = getPlayerNamesFromMatch(match, currentServingTeam);
              const isDoubles = teamPlayers.length > 1;

              return (
                <div className={`grid gap-3 ${isDoubles ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* サーバー表示 */}
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-m font-medium text-yellow-800">
                      サーブ: {servingPlayer.playerName}
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
                                team: currentServingTeam,
                                playerIndex: index,
                              });
                            }}
                            className={`px-3 py-1 text-xs border rounded font-medium transition-all ${
                              manualServingPlayer?.team === currentServingTeam && manualServingPlayer?.playerIndex === index
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
              const currentServingPlayer = getCurrentServingPlayer();
              const servingPlayerName = currentServingPlayer?.playerName || '';
              const servingPlayerKey = getPlayerUniqueId(
                currentServingPlayer?.team || currentServe || 'A',
                currentServingPlayer?.playerIndex || 0,
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
              const currentServingPlayer = getCurrentServingPlayer();
              const servingPlayerName = currentServingPlayer?.playerName || '';
              const servingPlayerKey = getPlayerUniqueId(
                currentServingPlayer?.team || currentServe || 'A',
                currentServingPlayer?.playerIndex || 0,
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
            {WINNER_BUTTONS.map(({ value, label }) => (
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
            {ERROR_BUTTONS.map(({ value, label }) => (
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
          {(['A', 'B'] as const).map((team) => (
            <div key={team}>
              <h5 className={`text-xs font-medium mb-1 text-center ${team === 'A' ? 'text-blue-600' : 'text-red-600'}`}>チーム {team}</h5>
              <div className="grid grid-cols-2 gap-1">
                {getPlayerNamesFromMatch(match, team).map((playerName: string, index: number) => {
                  const uniqueId = getPlayerUniqueId(team, index, playerName);
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
                        if (pointData.result_type && ERROR_RESULT_TYPES.has(pointData.result_type)) {
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
                          const playerFieldToUse = ERROR_RESULT_TYPES.has(pointData.result_type) ? newData.loser_player : newData.winner_player;
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
                            ? team === 'A'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-red-500 bg-red-50 text-red-700'
                            : pointData.loser_player === uniqueId
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : team === 'A'
                                ? 'border-gray-300 hover:border-blue-300'
                                : 'border-gray-300 hover:border-red-300'
                      }`}
                    >
                      {playerName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 動画時刻（デスクトップレイアウト時はサイドバー側に表示するため非表示） */}
      <div className={`mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 ${isPointInputActive ? 'xl:hidden' : ''}`}>
        <VideoTimeRangeInputs
          pointData={pointData}
          onChange={(updates) => setPointData({ ...pointData, ...updates })}
          startInputValue={getVideoStartInput()}
          endInputValue={getVideoEndInput()}
        />
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
              onClick={onUpdatePoint}
              disabled={!pointData.winner_team || submitting}
              className="flex-1 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
              {submitting ? '更新中...' : 'ポイント更新'}
            </button>
            <button
              onClick={onCancelEditPoint}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100"
            >
              キャンセル
            </button>
          </>
        ) : (
          <button
            onClick={onSubmitPoint}
            disabled={!pointData.winner_team || submitting}
            className="flex-1 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {submitting ? '記録中...' : 'ポイント記録'}
          </button>
        )}
      </div>

      {activeYouTubeVideoId && !youtubeEmbedBlocked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onCaptureVideoTime('start')} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
            開始を記録
          </button>
          <button
            type="button"
            onClick={() => onCaptureVideoTime('end')}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
          >
            終了を記録
          </button>
          <button type="button" onClick={onClearVideoRange} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-white">
            クリア
          </button>
        </div>
      )}
    </div>
  );
};

export default PointInputForm;
