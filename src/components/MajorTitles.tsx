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
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">主要タイトル</h2>
      <div className="mx-4 overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-max w-full text-sm text-gray-700 dark:text-gray-200 border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
