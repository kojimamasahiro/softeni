// src/components/TeamsRanking.tsx
import Link from 'next/link';

type TeamsRankingProps = {
  statsList: {
    id: string;
    name: string;
    appearances: number;
    wins: number;
    losses: number;
    winsByRound: Record<string, number>;
  }[];
  // pid -> 数値選手id（結果ページを持つ選手のみ）。リンク対象の解決済みマップ。
  playerLinks?: Record<string, number>;
};

export default function TeamsRanking({
  statsList,
  playerLinks = {},
}: TeamsRankingProps) {
  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        選手別成績
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                選手名
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                出場数
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                勝敗
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                勝率
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                優勝
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                準優勝
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                ベスト4
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                ベスト8
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {statsList.map((p) => {
              const wins = p.wins;
              const losses = p.losses;
              const total = wins + losses;
              const ratio =
                total > 0 ? `${((wins / total) * 100).toFixed(1)}%` : '-';
              const winLoss = total > 0 ? `${wins}-${losses}` : '-';

              return (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {playerLinks[p.id] !== undefined ? (
                      <Link
                        href={`/players/${playerLinks[p.id]}/results`}
                        className="text-blue-700 underline underline-offset-2 decoration-dotted hover:decoration-solid dark:text-blue-300"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {p.appearances}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {winLoss}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {ratio}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {p.winsByRound['優勝'] || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {p.winsByRound['準優勝'] || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {p.winsByRound['ベスト4'] || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {p.winsByRound['ベスト8'] || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
