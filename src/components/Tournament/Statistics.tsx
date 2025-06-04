// src/components/Tournament/Statistics.tsx

interface RankedTeam {
  rank: number;
  team: string;
  count: number;
}

interface Props {
  totalPlayers: number;
  uniqueTeams: number;
  totalMatches: number;
  totalGamesWon: number;
  totalGamesLost: number;
  rankedTeams: RankedTeam[];
}

export default function Statistics({
  totalPlayers,
  uniqueTeams,
  totalMatches,
  totalGamesWon,
  totalGamesLost,
  rankedTeams,
}: Props) {
  const rate = totalGamesWon + totalGamesLost > 0
    ? ((totalGamesWon / (totalGamesWon + totalGamesLost)) * 100).toFixed(2)
    : '0.00';

  return (
    <section className="mb-10">
      <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800 p-4">
        <h2 className="text-lg font-bold mb-3">大会統計</h2>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <div>エントリー数：{totalPlayers}人</div>
          <div>出場チーム数：{uniqueTeams}チーム</div>
          <div>総試合数：{totalMatches}試合</div>
          <div>
            総ゲーム数（獲得率）：{totalGamesWon} - {totalGamesLost}（{rate}%）
          </div>
          <div>
            <div className="font-semibold mb-1">チーム別出場人数ランキング</div>
            <div className="space-y-1 overflow-y-auto max-h-32 pr-2">
              {rankedTeams.map(({ rank, team, count }) => (
                <div key={team}>{rank}位：{team}（{count}人）</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
