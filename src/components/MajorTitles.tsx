// src/components/MajorTitles.tsx
import {
  MajorTitle,
  TournamentSummary,
  TournamentYearData,
} from '@/types/index';

export default function MajorTitles({
  id,
  tournaments,
}: {
  id: string;
  tournaments: TournamentSummary[];
}) {
  if (!tournaments || tournaments.length === 0) {
    return null;
  }

  const majorTitles: MajorTitle[] = tournaments
    .filter((tournament) => tournament.meta.isMajorTitle)
    .sort((a, b) => a.meta.sortId - b.meta.sortId)
    .map((tournament) => {
      const years = tournament.years.map((yearData: TournamentYearData) => {
        const year = parseInt(yearData.year, 10);
        if (yearData.status === 'scheduled') {
          return { year, result: yearData.scheduledDate || '(予定)' };
        } else if (yearData.status === 'canceled') {
          return { year, result: '(中止)' };
        } else if (yearData.status === 'completed') {
          const playerResult = yearData.results?.find((r) =>
            r.playerIds?.includes(id),
          );
          return { year, result: playerResult ? playerResult.result : 'ー' };
        }
        return { year, result: 'ー' };
      });

      return {
        name: tournament.meta.name,
        years,
      };
    });

  const allYears = Array.from(
    new Set(majorTitles.flatMap((title) => title.years.map((y) => y.year))),
  ).sort((a, b) => b - a);

  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        🏆 主要タイトル
      </h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* 横幅を100%に設定 */}
        <table className="min-w-max w-full text-sm text-gray-700 dark:text-gray-200 border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">
                {/* borderクラス削除 */}大会名
              </th>
              {allYears.map((year) => (
                <th key={year} className="px-4 py-2">
                  {/* borderクラス削除 */}
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {majorTitles.map((title, index) => (
              <tr
                key={index}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-2 font-medium">{title.name}</td>
                {allYears.map((year) => {
                  const found = title.years.find((y) => y.year === year);
                  return (
                    <td key={year} className="px-4 py-2 text-center">
                      {found?.result || 'ー'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
