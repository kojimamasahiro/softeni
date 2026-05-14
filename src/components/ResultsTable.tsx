// src/components/ResultsTable.tsx
import { MatchRow } from '@/types/tournament';

export default function ResultsTable({
  rows,
  className = '',
}: {
  rows: MatchRow[];
  className?: string;
}) {
  return (
    <table
      className={`w-full text-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <thead className="bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">
            ラウンド
          </th>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">
            対戦相手
          </th>
          <th className="border-b border-gray-300 dark:border-gray-600 px-2 py-1">
            スコア
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((match, i) => {
          const round = match.round ?? '予選';
          const opponentDisplay = match.opponentDisplayName ?? '不明';
          const scoreDisplay = `${match.games.won}-${match.games.lost}`;

          return (
            <tr key={i} className="text-center">
              <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">
                {round}
              </td>
              <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">
                {opponentDisplay}
              </td>
              <td className="border-b border-gray-200 dark:border-gray-700 px-2 py-1">
                {scoreDisplay}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
