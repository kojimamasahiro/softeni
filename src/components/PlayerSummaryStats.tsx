import { PlayerInfo, PlayerStats } from '@/types/index';
import Link from 'next/link';

type SummaryStatsProps = {
  playerStats: PlayerStats;
  allPlayers: PlayerInfo[];
};

type StatsRowProps = {
  label: string;
  stats: {
    matches: { wins: number; losses: number; winRate: number };
    games?: { won: number; lost: number; gameRate: number };
  };
  link?: string;
};

function formatGameStats(games?: { won: number; lost: number; gameRate: number }) {
  if (!games) return '―';
  return `${games.won} - ${games.lost}（${(games.gameRate * 100).toFixed(1)}%）`;
}

function StatsRow({ label, stats, link }: StatsRowProps) {
  return (
    <tr className="border-t border-gray-200 dark:border-gray-600 text-center">
      <td className="py-1 px-2">
        {link ? (
          <Link
            href={link}
            className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
          >
            {label}
          </Link>
        ) : (
          label
        )}
      </td>
      <td className="py-1 px-2">
        {stats.matches.wins}勝 {stats.matches.losses}敗（{(stats.matches.winRate * 100).toFixed(1)}%）
      </td>
      <td className="py-1 px-2">{formatGameStats(stats.games)}</td>
    </tr>
  );
}

function StatsTable({
  title,
  data,
  isYear = false,
  allPlayers,
}: {
  title: string;
  data: Record<string, any>;
  isYear?: boolean;
  allPlayers: PlayerInfo[];
}) {
  const entries = Object.entries(data);
  const sortedEntries = isYear
    ? entries.sort(([a], [b]) => Number(b) - Number(a))
    : entries;

  return (
    <div className="mb-4">
      <h4 className="text-base font-semibold mb-2">{title}</h4>
      <table className="w-full border border-gray-200 dark:border-gray-600 text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          <tr>
            <th className="py-1 px-2 text-center">{isYear ? '年度' : 'パートナー'}</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
            <th className="py-1 px-2 text-center">ゲーム（獲得率）</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map(([key, stats]) => {
            const label = isYear
              ? `${key}年`
              : allPlayers.find((p) => p.id === key)
              ? `${allPlayers.find((p) => p.id === key)!.lastName} ${allPlayers.find((p) => p.id === key)!.firstName}`
              : key;

            const link = !isYear && allPlayers.find((p) => p.id === key)
              ? `/players/${key}`
              : undefined;

            return <StatsRow key={key} label={label} stats={stats} link={link} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayerSummaryStats({ playerStats, allPlayers }: SummaryStatsProps) {
  if (!playerStats || !playerStats.totalMatches) return null;

  return (
    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm bg-white dark:bg-gray-800">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">対戦成績</h3>

      {/* 総合成績 */}
      <table className="w-full mb-4 border border-gray-200 dark:border-gray-700 text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
          <tr>
            <th className="py-1 px-2 text-center">試合数</th>
            <th className="py-1 px-2 text-center">勝敗（勝率）</th>
            <th className="py-1 px-2 text-center">ゲーム（獲得率）</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-center">
            <td className="py-1 px-2">{playerStats.totalMatches}</td>
            <td className="py-1 px-2">
              {playerStats.wins}勝 {playerStats.losses}敗（
              {(playerStats.totalWinRate * 100).toFixed(1)}%）
            </td>
            <td className="py-1 px-2">
              {formatGameStats(playerStats.games)}
            </td>
          </tr>
        </tbody>
      </table>

      <StatsTable title="パートナー別" data={playerStats.byPartner} allPlayers={allPlayers} />
      <StatsTable title="年度別" data={playerStats.byYear} allPlayers={allPlayers} isYear />
    </div>
  );
}
