import { PlayerInfo, SummaryStats } from '@/types/index';
import Link from 'next/link';

type SummaryStatsProps = {
  summaryStats: SummaryStats;
  allPlayers: PlayerInfo[];
};

export default function PlayerSummaryStats({ summaryStats, allPlayers }: SummaryStatsProps) {
  if (!summaryStats || !summaryStats.totalMatches) {
    return null;
  }

  return (
    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">サマリー</h3>

      <table className="w-full mb-4">
        <tbody>
          <tr>
            <td className="py-1 pr-4 font-medium text-center">試合数</td>
            <td className="py-1 text-center">{summaryStats.totalMatches}</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 font-medium text-center">勝敗</td>
            <td className="py-1 text-center">{summaryStats.wins}勝 {summaryStats.losses}敗</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 font-medium text-center">勝率</td>
            <td className="py-1 text-center">{(summaryStats.totalWinRate * 100).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4">
        <h4 className="text-base font-semibold mb-2">パートナー別</h4>
        <table className="w-full border border-gray-200 dark:border-gray-600 text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            <tr>
              <th className="py-1 px-2 text-center">パートナー</th>
              <th className="py-1 px-2 text-center">成績</th>
              <th className="py-1 px-2 text-center">勝率</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summaryStats.byPartner).map(([partnerId, stats]) => {
              const partner = allPlayers.find((p) => p.id === partnerId);
              const partnerName = partner ? `${partner.lastName} ${partner.firstName}` : partnerId;

              return (
                <tr key={partnerId} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 px-2 text-center">
                    {partner ? (
                      <Link href={`/players/${partner.id}`} className="text-center text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid">
                        {partnerName}
                      </Link>
                    ) : (
                      partnerName
                    )}
                  </td>
                  <td className="py-1 px-2 text-center">{stats.matches.wins}勝 {stats.matches.losses}敗</td>
                  <td className="py-1 px-2 text-center">{(stats.matches.winRate * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h4 className="text-base font-semibold mb-2">年度別</h4>
        <table className="w-full border border-gray-200 dark:border-gray-600 text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            <tr>
              <th className="py-1 px-2 text-center">年度</th>
              <th className="py-1 px-2 text-center">成績</th>
              <th className="py-1 px-2 text-center">勝率</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summaryStats.byYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, stats]) => (
                <tr key={year} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-1 px-2 text-center">{year}年</td>
                  <td className="py-1 px-2 text-center">{stats.matches.wins}勝 {stats.matches.losses}敗</td>
                  <td className="py-1 px-2 text-center">{(stats.matches.winRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* <div className="text-right mt-4">
        <Link href={`/players/${summaryStats.playerId}/analysis`} className="text-sm text-blue-500 hover:underline">
          グラフ・詳細データを見る →
        </Link>
      </div> */}
    </div>
  );
}
