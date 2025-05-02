import liveData from '@/data/live.json';

interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
}

export default function LiveResultsByTournament({ playersData }: { playersData: PlayerInfo[] }) {
  if (!playersData || playersData.length === 0) {
    return null; // 選手データがない場合は何も表示しない
  }

  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedAtJST = new Date(liveData.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  if (updatedAtJST !== todayJST) {
    return null; // 日本時間での今日でなければ非表示
  }

  return (
<section className="mb-8">
  <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🎾 大会速報</h2>
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
    {/* 大会名を元のサイズに戻す */}
    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{liveData.tournament}</h3>
    
    <ul className="space-y-2 text-gray-700 dark:text-gray-300">
      {liveData.players.map((player, index) => {
        const playerInfo = playersData.find((p) => p.id === player.playerId);
        const playerName = playerInfo ? `${playerInfo.lastName}${playerInfo.firstName}` : player.playerId;
  
        return (
          <li key={index} className="mb-4">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between">
                <strong className="text-gray-800 dark:text-white">
                  {playerName}
                </strong>
              </div>
              <div className="flex justify-between items-center space-x-4">
                <div className="flex-shrink-0 w-1/3 text-center">
                  <span className="text-gray-600 dark:text-gray-300">最新結果:</span>
                </div>
                <div className="flex-grow text-center">
                  <span className="text-gray-800 dark:text-white">
                    {player.latestResult}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center space-x-4">
                <div className="flex-shrink-0 w-1/3 text-center">
                  <span className="text-gray-600 dark:text-gray-300">次の試合:</span>
                </div>
                <div className="flex-grow text-center">
                  <span className="text-gray-800 dark:text-white">{player.nextMatch}</span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>

    <div className="mt-4 text-right text-sm text-gray-600 dark:text-gray-300">
      最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
    </div>
  </div>
</section>



  );
}
