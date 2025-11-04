import React, { useState } from 'react';

interface ServeSelectionProps {
  teamA: string;
  teamB: string;
  onServeTeamSelected: (team: 'A' | 'B') => void;
  gameNumber: number;
}

const ServeSelection: React.FC<ServeSelectionProps> = ({
  teamA,
  teamB,
  onServeTeamSelected,
  gameNumber,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B' | null>(null);

  const handleTeamSelect = (team: 'A' | 'B') => {
    setSelectedTeam(team);
  };

  const handleConfirm = () => {
    if (selectedTeam) {
      onServeTeamSelected(selectedTeam);
    }
  };

  const getGameText = () => {
    if (gameNumber === 1) {
      return '第1ゲーム開始時のサーブ権を決定してください';
    }
    return `第${gameNumber}ゲームのサーブ権（自動決定）`;
  };

  const getInstructions = () => {
    if (gameNumber === 1) {
      return (
        <div className="text-sm text-gray-600 mt-2">
          <p>• ゲームごとにサーブ権が交代します</p>
          <p>• 通常のゲーム: 2ポイントごとにサーブ交代</p>
          <p>• ファイナルゲーム: 最初の1ポイントで交代、その後2ポイントごと</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4 text-yellow-800">
          🏓 サーブ権の決定
        </h3>
        <p className="text-yellow-700 mb-4">{getGameText()}</p>

        {gameNumber === 1 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleTeamSelect('A')}
                className={`p-4 border-2 rounded-lg font-medium transition-all ${
                  selectedTeam === 'A'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="text-lg font-bold">チーム A</div>
                <div className="text-sm mt-1 text-gray-600 break-all">
                  {teamA}
                </div>
              </button>
              <button
                onClick={() => handleTeamSelect('B')}
                className={`p-4 border-2 rounded-lg font-medium transition-all ${
                  selectedTeam === 'B'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 hover:border-red-300'
                }`}
              >
                <div className="text-lg font-bold">チーム B</div>
                <div className="text-sm mt-1 text-gray-600 break-all">
                  {teamB}
                </div>
              </button>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selectedTeam}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              サーブ権を確定
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-lg text-green-600 font-medium">
              サーブ権は自動で決定されています
            </p>
            <button
              onClick={() => onServeTeamSelected('A')} // 実際は自動計算される
              className="mt-4 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
            >
              ゲームを開始
            </button>
          </div>
        )}

        {getInstructions()}
      </div>
    </div>
  );
};

export default ServeSelection;
