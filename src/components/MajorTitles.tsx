// src/components/MajorTitles.tsx
import Link from 'next/link';

interface MajorTitleData {
  name: string;
  years: { year: number; result: string }[];
  link?: string;
}

export default function MajorTitles({ majorTitlesData }: { majorTitlesData: MajorTitleData[] }) {
  if (!majorTitlesData || majorTitlesData.length === 0) {
    return null;
  }

  const allYears = Array.from(new Set(majorTitlesData.flatMap((title) => title.years.map((y) => y.year)))).sort((a, b) => b - a);

  return (
    <section className="mb-8">
      {/* 2026-08-07: 大会結果（PlayerResults.tsx）の中に移設したため、隣接する
          年グループの見出し（`<h3 className="text-xl font-semibold text-text mb-3">`）と
          同じ h3 に揃える（大会結果の h2 の下に主要タイトル・各年が並列で並ぶ構成のため）。 */}
      <h3 className="text-xl font-semibold text-text mb-3">主要タイトル</h3>
      {/* 2026-08-07: mx-4 を撤去。大会結果の中に移設した結果、隣接する試合結果カード
          （PlayerResults.tsx、mx-4 無し）と左右がずれて見えたため、幅を揃えた。 */}
      <div className="overflow-x-auto bg-surface rounded-lg shadow">
        <table className="min-w-max w-full text-sm text-gray-700 dark:text-gray-200 border-collapse">
          <thead className="bg-bg-subtle text-text">
            <tr>
              <th className="px-4 py-2 text-left">大会名</th>
              {allYears.map((year) => (
                <th key={year} className="px-4 py-2">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {majorTitlesData.map((title, index) => (
              <tr key={index} className="hover:bg-bg-subtle">
                <td className="px-4 py-2 font-medium">
                  {title.link ? (
                    <Link href={title.link} className="underline underline-offset-2 decoration-dotted hover:decoration-solid">
                      {title.name}
                    </Link>
                  ) : (
                    title.name
                  )}
                </td>
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
