import { MatchResult } from '@/types/index';

export default function ResultsTable({ results, className = '' }: { results: MatchResult[]; className?: string }) {
  return (
    <table className={`w-full text-sm border border-gray-200 dark:border-gray-700 ${className}`}>
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
