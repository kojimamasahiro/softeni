import { MatchResult, PlayerData, PlayerInfo, Tournament } from '@/types/types';
import Link from 'next/link';

type PlayerResultsProps = {
  playerData: PlayerData;
  allPlayers: PlayerInfo[];
};

export default function PlayerResults({ playerData, allPlayers }: PlayerResultsProps) {
  if (!playerData || !playerData.matches || playerData.matches.length === 0) {
    return <p>試合結果がありません。</p>;
  }

  const tournamentsByName: { [name: string]: Tournament[] } = {};
  playerData.matches.forEach((tournament) => {
    if (!tournamentsByName[tournament.tournament]) {
      tournamentsByName[tournament.tournament] = [];
    }
    tournamentsByName[tournament.tournament].push(tournament);
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">🎾 大会結果</h2>

      {Object.entries(tournamentsByName).map(([tournamentName, tournaments], index) => (
        <div key={index} className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{tournamentName}</h3>

          {tournaments[0].dateRange && <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">日程 {tournaments[0].dateRange}</div>}
          {tournaments[0].location && <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">場所 {tournaments[0].location}</div>}
          {tournaments[0].link && (
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              詳細 <a href={tournaments[0].link} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">大会ページ</a>
            </div>
          )}
          {tournaments[0].partner && (
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              ペア {
                (() => {
                  const partner = allPlayers.find(p => p.id === tournaments[0].partner);
                  return partner ? (
                    <Link href={`/players/${partner.id}`} className="underline text-blue-600 dark:text-blue-400">
                      {partner.lastName} {partner.firstName}
                    </Link>
                  ) : tournaments[0].partner;
                })()
              }
            </div>
          )}
          {tournaments[0].finalResult && <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">最終結果：{tournaments[0].finalResult}</div>}

          {tournaments.map((tournament, idx) => (
            <div key={idx} className="mb-4">
              {tournament.format === 'combined' && (
                <>
                  {tournament.groupStage && (
                    <div className="mb-3">
                      <h4 className="font-semibold mb-1">グループステージ（{tournament.groupStage.group || 'グループ'}）</h4>
                      {renderTable(tournament.groupStage.results)}
                    </div>
                  )}
                  {tournament.finalStage && (
                    <div className="mb-3">
                      <h4 className="font-semibold mb-1">決勝トーナメント</h4>
                      {renderTable(tournament.finalStage.results)}
                    </div>
                  )}
                </>
              )}

              {tournament.format === 'tournament' && tournament.results && (
                <div className="mb-3">
                  <h4 className="font-semibold mb-1">トーナメント</h4>
                  {renderTable(tournament.results)}
                </div>
              )}

              {tournament.format === 'round-robin' && tournament.results && (
                <div className="mb-3">
                  <h4 className="font-semibold mb-1">ラウンドロビン</h4>
                  {renderTable(tournament.results)}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderTable(results: MatchResult[]) {
  return (
    <table className="w-full border border-gray-200 dark:border-gray-700 text-sm">
      <thead className="bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">ラウンド</th>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">対戦相手</th>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">スコア</th>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">勝敗</th>
        </tr>
      </thead>
      <tbody>
        {results.map((match, i) => (
          <tr key={i} className="text-center">
            <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">{match.round}</td>
            <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">{match.opponent}</td>
            <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">{match.score}</td>
            <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">{match.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
