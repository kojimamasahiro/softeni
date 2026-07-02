import React, { useEffect, useState } from 'react';

interface ServeSelectionProps {
  teamA: string;
  teamB: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  onServeTeamSelected: (team: 'A' | 'B', playerIndex?: number) => void;
  gameNumber: number;
  preselectedTeam?: 'A' | 'B'; // 第2ゲーム以降で自動決定されたサーブチーム
}

const ServeSelection: React.FC<ServeSelectionProps> = ({ teamA, teamB, teamAPlayers, teamBPlayers, onServeTeamSelected, gameNumber, preselectedTeam }) => {
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B' | null>(preselectedTeam ?? null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number>(0);

  // preselectedTeamが変更されたときにselectedTeamを更新
  useEffect(() => {
    if (preselectedTeam) {
      setSelectedTeam(preselectedTeam);
    }
  }, [preselectedTeam]);

  const handleTeamSelect = (team: 'A' | 'B') => {
    setSelectedTeam(team);
    setSelectedPlayerIndex(0); // チーム変更時は最初の選手にリセット
  };

  const handlePlayerSelect = (playerIndex: number) => {
    setSelectedPlayerIndex(playerIndex);
  };

  const handleConfirm = () => {
    if (selectedTeam) {
      onServeTeamSelected(selectedTeam, selectedPlayerIndex);
    }
  };

  // 選択されたチームが ダブルスかどうかを判定
  const isDoubles = () => {
    if (selectedTeam === 'A') {
      return teamAPlayers.length > 1;
    } else if (selectedTeam === 'B') {
      return teamBPlayers.length > 1;
    }
    return false;
  };

  // 選択されたチームの選手リストを取得
  const getSelectedTeamPlayers = () => {
    if (selectedTeam === 'A') {
      return teamAPlayers;
    } else if (selectedTeam === 'B') {
      return teamBPlayers;
    }
    return [];
  };

  const getGameText = () => {
    if (gameNumber === 1) {
      return '第1ゲーム開始時のサーブ権を決定してください';
    }
    return `第${gameNumber}ゲーム開始時のサーブ選手を選択してください`;
  };

  const getInstructions = () => {
    if (gameNumber === 1) {
      return (
        <div className="text-sm text-gray-600 mt-2">
          <p>• ゲームごとにサーブ権が交代します</p>
          <p>• 通常ゲーム: 同じチームがゲーム全体をサーブ、選手は2ポイントごとに交代</p>
          <p>• ファイナルゲーム: 7点先取・2点差、2ポイントごとにチーム・選手が交代</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4 text-yellow-800">🏓 サーブ権の決定</h3>
        <p className="text-yellow-700 mb-4">{getGameText()}</p>

        <>
          {/* 第1ゲーム: チーム選択 */}
          {gameNumber === 1 && (
            <div className="mb-6">
              <h4 className="text-md font-medium mb-3 text-yellow-700">ステップ1: サーブを行うチームを選択</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleTeamSelect('A')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    selectedTeam === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-lg font-bold">チーム A</div>
                  <div className="text-sm mt-1 text-gray-600 break-all">{teamA}</div>
                </button>
                <button
                  onClick={() => handleTeamSelect('B')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    selectedTeam === 'B' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
                  }`}
                >
                  <div className="text-lg font-bold">チーム B</div>
                  <div className="text-sm mt-1 text-gray-600 break-all">{teamB}</div>
                </button>
              </div>
            </div>
          )}

          {/* 選手選択 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-yellow-700">
              {gameNumber === 1 ? 'ステップ2: 最初にサーブを行う選手を選択' : 'サーブを行う選手を選択（デフォルト: 1番目の選手）'}
            </h4>

            {gameNumber === 1 && selectedTeam && isDoubles() ? (
              /* 第1ゲーム: 選択されたチームの選手のみ表示 */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto">
                {getSelectedTeamPlayers().map((playerName, index) => (
                  <button
                    key={index}
                    onClick={() => handlePlayerSelect(index)}
                    className={`p-3 border-2 rounded-lg font-medium transition-all text-sm ${
                      selectedPlayerIndex === index
                        ? selectedTeam === 'A'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {playerName}
                  </button>
                ))}
              </div>
            ) : gameNumber > 1 ? (
              /* 第2ゲーム以降: 両チームの選手を表示 */
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    {preselectedTeam ? `サーブチーム: ${preselectedTeam === 'A' ? teamA : teamB}` : 'サーブチームは自動決定されます。'}
                    サーブ選手を選択してください。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* チームA */}
                  <div className="border rounded-lg p-3">
                    <h5 className="text-sm font-medium mb-2 text-center text-blue-600">チーム A</h5>
                    <div className="space-y-2">
                      {teamAPlayers.map((playerName, index) => (
                        <button
                          key={`A-${index}`}
                          onClick={() => {
                            handleTeamSelect('A');
                            handlePlayerSelect(index);
                          }}
                          className={`w-full p-2 border-2 rounded font-medium transition-all text-sm ${
                            selectedTeam === 'A' && selectedPlayerIndex === index
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-blue-300'
                          }`}
                        >
                          {playerName}
                          {index === 0 && <span className="text-xs text-gray-500 ml-1">(デフォルト)</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* チームB */}
                  <div className="border rounded-lg p-3">
                    <h5 className="text-sm font-medium mb-2 text-center text-red-600">チーム B</h5>
                    <div className="space-y-2">
                      {teamBPlayers.map((playerName, index) => (
                        <button
                          key={`B-${index}`}
                          onClick={() => {
                            handleTeamSelect('B');
                            handlePlayerSelect(index);
                          }}
                          className={`w-full p-2 border-2 rounded font-medium transition-all text-sm ${
                            selectedTeam === 'B' && selectedPlayerIndex === index
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : 'border-gray-300 hover:border-red-300'
                          }`}
                        >
                          {playerName}
                          {index === 0 && <span className="text-xs text-gray-500 ml-1">(デフォルト)</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-gray-600 mt-2 text-center">
              {gameNumber === 1 ? 'ゲーム内で2人が交互にサーブを行います' : 'デフォルトでは1番目の選手が選択されています'}
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={gameNumber === 1 ? !selectedTeam : false}
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {gameNumber === 1 && selectedTeam && isDoubles()
              ? `${getSelectedTeamPlayers()[selectedPlayerIndex]} のサーブで開始`
              : gameNumber === 1
                ? 'サーブ権を確定'
                : `第${gameNumber}ゲームを開始`}
          </button>
        </>

        {getInstructions()}
      </div>
    </div>
  );
};

export default ServeSelection;
