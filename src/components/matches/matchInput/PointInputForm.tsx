import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  determineWinnerTeam,
  ERROR_BUTTONS,
  ERROR_RESULT_TYPES,
  getPlayerNameFromId,
  getPlayerNamesFromMatch,
  getPlayerUniqueId,
  WINNER_BUTTONS,
} from '../../../../lib/matchLogic';
import { inferPointData, type PointInferenceContext } from '../../../../lib/pointInference';
import { formatVideoTimestamp } from '../../../../lib/youtubePlayback';
import type { Match, Point } from '../../../types/database';
import type { ManualServingPlayer, PointDataState } from './types';
import VideoTimeRangeInputs from './VideoTimeRangeInputs';

type PointInputFormProps = {
  match: Match;
  isEditMode: boolean;
  editingPoint: Point | null;
  submitting: boolean;
  pointData: PointDataState;
  setPointData: Dispatch<SetStateAction<PointDataState>>;
  pointInferenceContext: PointInferenceContext;
  manualServingPlayer: ManualServingPlayer;
  setManualServingPlayer: Dispatch<SetStateAction<ManualServingPlayer>>;
  activeYouTubeVideoId: string | null;
  youtubeEmbedBlocked: boolean;
  getVideoStartInput: () => string;
  getVideoEndInput: () => string;
  onCaptureVideoTime: (target: 'start' | 'end') => void;
  onClearVideoRange: () => void;
  onSelectServiceAce: () => void;
  onSelectDoubleFault: () => void;
  onToggleFirstServeFault: () => void;
  onSubmitPoint: () => void;
  onUpdatePoint: () => void;
  onCancelEditPoint: () => void;
};

/** ボタンに割り当てキーを小さく併記する。装飾なので読み上げ対象から外す。 */
const ShortcutKeyHint = ({ shortcutKey }: { shortcutKey: string }) => (
  <span aria-hidden="true" className="ml-1 rounded border border-current px-1 text-[10px] font-normal opacity-60">
    {shortcutKey}
  </span>
);

const PointInputForm = ({
  match,
  isEditMode,
  editingPoint,
  submitting,
  pointData,
  setPointData,
  pointInferenceContext,
  manualServingPlayer,
  setManualServingPlayer,
  activeYouTubeVideoId,
  youtubeEmbedBlocked,
  getVideoStartInput,
  getVideoEndInput,
  onCaptureVideoTime,
  onClearVideoRange,
  onSelectServiceAce,
  onSelectDoubleFault,
  onToggleFirstServeFault,
  onSubmitPoint,
  onUpdatePoint,
  onCancelEditPoint,
}: PointInputFormProps) => {
  // サーブ／レシーブの表示は自動推定が使っている文脈と同じものを見せる。
  // 編集モードでは「次のポイント」ではなく編集対象ポイントのサーブになる。
  const currentServingTeam = pointInferenceContext.servingTeam;
  const servingPlayerName = pointInferenceContext.servingPlayerId ? getPlayerNameFromId(pointInferenceContext.servingPlayerId) : '';
  const receivingPlayerName = pointInferenceContext.receivingPlayerId ? getPlayerNameFromId(pointInferenceContext.receivingPlayerId) : '';
  const servingTeamPlayers = currentServingTeam ? getPlayerNamesFromMatch(match, currentServingTeam) : [];
  const isServingTeamDoubles = servingTeamPlayers.length > 1;
  const showServePanel = Boolean(currentServingTeam && servingPlayerName);

  const showVideoCaptureButtons = Boolean(activeYouTubeVideoId) && !youtubeEmbedBlocked;
  // 動画がある場合、xl では手入力はサイドバー側に出るのでこちらは隠す
  const manualTimeInputClass = activeYouTubeVideoId ? (showVideoCaptureButtons ? 'mt-3 border-t border-gray-200 pt-3 xl:hidden' : 'xl:hidden') : '';

  /**
   * 入力内容を更新するときは必ず自動推定を通す。
   * 推定は空欄だけを埋めるので、手で選んだ値が書き換わることはない。
   */
  const applyPointData = (nextData: PointDataState) => {
    setPointData(inferPointData(nextData, pointInferenceContext));
  };

  // 「開始/終了を記録」ボタン押下直後に一時的な確認表示を出すためのフラグ
  const [justCaptured, setJustCaptured] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!justCaptured) return;
    const timer = setTimeout(() => setJustCaptured(null), 1500);
    return () => clearTimeout(timer);
  }, [justCaptured]);

  const handleCaptureVideoTime = (target: 'start' | 'end') => {
    onCaptureVideoTime(target);
    setJustCaptured(target);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">{isEditMode ? 'ポイント編集' : 'ポイント記録'}</h3>
        {isEditMode && editingPoint && <p className="text-sm text-blue-600 mt-1">#{editingPoint.point_number} を編集中</p>}
      </div>

      {/*
        サーブ選手（表示＋手動選択）と動画時刻を左右に並べる。
        動画時刻はポイントの区切りを先に押さえてから中身を入力する流れなので、他の項目より上に置く。
      */}
      <div className={`mb-4 grid gap-3 ${showServePanel ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {showServePanel && currentServingTeam && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm font-medium text-yellow-800">
              サーブ: チーム {currentServingTeam} {servingPlayerName}
              {manualServingPlayer && !isEditMode && <span className="text-xs text-blue-600 ml-2">(手動選択)</span>}
            </p>
            <p className="mt-0.5 text-xs text-yellow-700">
              レシーブ: チーム {pointInferenceContext.receivingTeam} {receivingPlayerName}
            </p>

            {/* 手動サーブ選手選択（ダブルスの場合のみ）。同じカード内、横1行に並べる。 */}
            {!isEditMode && isServingTeamDoubles && (
              <div className="mt-2 flex gap-1">
                {servingTeamPlayers.map((playerName, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setManualServingPlayer({
                        team: currentServingTeam,
                        playerIndex: index,
                      });
                    }}
                    className={`min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs font-medium transition-all ${
                      manualServingPlayer?.team === currentServingTeam && manualServingPlayer?.playerIndex === index
                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    {playerName}
                  </button>
                ))}
                <button
                  onClick={() => setManualServingPlayer(null)}
                  className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:border-red-300 hover:text-red-600"
                >
                  自動
                </button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          {showVideoCaptureButtons && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCaptureVideoTime('start')}
                  aria-live="polite"
                  className={`rounded px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                    justCaptured === 'start' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {justCaptured === 'start' ? '✓ 記録しました' : '開始を記録'}
                  {justCaptured !== 'start' && <ShortcutKeyHint shortcutKey="S" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCaptureVideoTime('end')}
                  aria-live="polite"
                  className={`rounded px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                    justCaptured === 'end' ? 'bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {justCaptured === 'end' ? '✓ 記録しました' : '終了を記録'}
                  {justCaptured !== 'end' && <ShortcutKeyHint shortcutKey="E" />}
                </button>
                <button type="button" onClick={onClearVideoRange} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-white">
                  クリア
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-600">
                開始: {formatVideoTimestamp(pointData.video_start_ms, true)} ／ 終了: {formatVideoTimestamp(pointData.video_end_ms, true)}
              </p>
            </>
          )}

          {/* 手入力（デスクトップの動画レイアウト時はサイドバー側に出るため非表示） */}
          <div className={manualTimeInputClass}>
            <VideoTimeRangeInputs
              pointData={pointData}
              onChange={(updates) => applyPointData({ ...pointData, ...updates })}
              startInputValue={getVideoStartInput()}
              endInputValue={getVideoEndInput()}
            />
          </div>
        </div>
      </div>

      {/* サーブ情報 */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2 text-center">サーブ情報</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onSelectServiceAce}
            className={`p-2 border-2 rounded font-medium transition-all text-xs ${
              pointData.result_type === 'service_ace' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-green-300'
            }`}
          >
            サービスエース
            <ShortcutKeyHint shortcutKey="A" />
          </button>
          <button
            disabled={pointData.result_type === 'double_fault'}
            onClick={onToggleFirstServeFault}
            className={`p-2 border-2 rounded font-medium transition-all text-xs ${
              pointData.result_type === 'double_fault'
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : pointData.first_serve_fault
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-300 hover:border-orange-300'
            }`}
          >
            1stフォルト
            <ShortcutKeyHint shortcutKey="F" />
          </button>
          <button
            onClick={onSelectDoubleFault}
            className={`p-2 border-2 rounded font-medium transition-all text-xs ${
              pointData.result_type === 'double_fault' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-purple-300'
            }`}
          >
            ダブルフォルト
            <ShortcutKeyHint shortcutKey="D" />
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
                onClick={() => applyPointData({ ...pointData, rally_count: count })}
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
                  applyPointData(newData);
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
                  // レシーブ失敗は「誰が失敗したか」「どちらの得点か」が試合の進行から一意に決まるので、
                  // 先に空にして自動推定で入れ直す（手で選び直せば上書きされない）
                  const isReceiveError = value === 'receive_error';
                  const newData = {
                    ...pointData,
                    result_type: value,
                    // レシーブ失敗の場合はラリー数を2に設定
                    rally_count: isReceiveError ? 2 : pointData.rally_count,
                    // サーブ関連の自動設定をクリア（ただしダブルフォルト以外）
                    double_fault: false,
                    winner_player: '',
                    loser_player: isReceiveError ? '' : pointData.loser_player,
                    winner_team: isReceiveError ? '' : pointData.winner_team,
                  };
                  // 関与選手が設定されていれば勝者チームを自動決定
                  if (!isReceiveError && pointData.winner_player) {
                    const autoWinner = determineWinnerTeam(pointData.winner_player, value);
                    if (autoWinner) {
                      newData.winner_team = autoWinner;
                    }
                  }
                  applyPointData(newData);
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
            <p className="text-xs text-yellow-600 mt-1">現在のサーブ選手: {servingPlayerName}</p>
          </div>
        )}

        {/* レシーブ失敗時：自動選択したレシーブ選手を明示する（推定が外れていたら手で選び直せる） */}
        {pointData.result_type === 'receive_error' && (
          <div className="mb-3 rounded border border-yellow-200 bg-yellow-50 p-2 text-center">
            <p className="text-xs text-yellow-800">レシーブ失敗：レシーブ選手が自動選択されています</p>
            <p className="mt-1 text-xs text-yellow-600">
              サーブ: チーム {currentServingTeam ?? '-'} {servingPlayerName || '-'}
              {' ／ '}
              レシーブ: チーム {pointInferenceContext.receivingTeam ?? '-'} {receivingPlayerName || '-'}
            </p>
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
                        applyPointData(newData);
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

      {/* 勝者チーム */}
      <div className="mb-4">
        <div className="text-center mb-2">
          <h4 className="text-sm font-medium">勝者チーム</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => applyPointData({ ...pointData, winner_team: 'A' })}
            className={`p-2 border-2 rounded font-medium transition-all text-sm ${
              pointData.winner_team === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
            }`}
          >
            チーム A
          </button>
          <button
            onClick={() => applyPointData({ ...pointData, winner_team: 'B' })}
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
              {!submitting && <ShortcutKeyHint shortcutKey="G" />}
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
            {!submitting && <ShortcutKeyHint shortcutKey="G" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default PointInputForm;
