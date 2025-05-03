import titlesData from '@/data/titles.json';

interface PlayerResult {
  playerId: string;
  result: string;
}

interface TitleYearData {
  status: 'scheduled' | 'completed' | 'canceled';
  scheduledDate?: string;
  results: PlayerResult[];
}

interface TitleData {
  years: {
    [year: string]: TitleYearData;
  };
}

interface TitlesData {
  [tournamentName: string]: TitleData;
}

interface YearResult {
  year: number;
  result: string;
}

interface MajorTitle {
  name: string;
  years: YearResult[];
}

export default function MajorTitles({ id }: { id: string }) {
  if (!titlesData) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400">
        主要タイトルのデータがありません
      </div>
    );
  }

  const majorTitles: MajorTitle[] = Object.entries(titlesData as TitlesData).map(
    ([tournamentName, tournamentData]) => {
      const years = Object.entries(tournamentData.years).map(([yearStr, yearData]) => {
        const year = parseInt(yearStr, 10);
        if (yearData.status === 'scheduled') {
          return { year, result: yearData.scheduledDate || '(予定)' };
        } else if (yearData.status === 'canceled') {
          return { year, result: '(中止)' };
        } else if (yearData.status === 'completed') {
          const playerResult = yearData.results.find((r) => r.playerId === id);
          return { year, result: playerResult ? playerResult.result : 'ー' };
        }
        return { year, result: 'ー' };
      });
      return { name: tournamentName, years };
    }
  );

  const allYears = Array.from(
    new Set(majorTitles.flatMap((title) => title.years.map((y) => y.year)))
  ).sort((a, b) => b - a);

  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        🏆 主要タイトル
      </h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* 横スクロールを有効化 */}
        <table className="min-w-max text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <tr>
              <th className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-left">大会名</th>
              {allYears.map((year) => (
                <th key={year} className="px-4 py-2 border border-gray-200 dark:border-gray-600">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {majorTitles.map((title, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2 border border-gray-200 dark:border-gray-600 font-medium">
                  {title.name}
                </td>
                {allYears.map((year) => {
                  const found = title.years.find((y) => y.year === year);
                  return (
                    <td
                      key={year}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-center"
                    >
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
