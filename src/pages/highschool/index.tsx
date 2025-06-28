// pages/highschool/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';

type Entry = {
  team: string;
  teamId: string;
  prefecture: string;
  prefectureId: string;
  result: string;
  category: 'singles' | 'doubles' | 'team';
  tournamentId: string;
  year: number;
};

type Props = {
  data: Entry[];
};

const TOURNAMENT_LABEL = 'ハイスクールジャパンカップ';
const TOURNAMENT_YEAR = 2025;

export default function HighschoolIndex({ data }: Props) {
  // 都道府県でグループ化
  const grouped = data.reduce((acc: Record<string, Entry[]>, item) => {
    if (!acc[item.prefecture]) acc[item.prefecture] = [];
    acc[item.prefecture].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        高校別成績一覧（{TOURNAMENT_YEAR} {TOURNAMENT_LABEL}）
      </h1>
      {Object.entries(grouped).map(([pref, entries]) => (
        <div key={pref} className="mb-6">
          <h2 className="text-lg font-semibold">{pref}</h2>
          <ul className="ml-4 list-disc">
            {entries.map((entry) => (
              <li key={`${entry.category}-${entry.teamId}`}>
                {entry.category === 'singles'
                  ? 'シングルス'
                  : entry.category === 'doubles'
                    ? 'ダブルス'
                    : '団体戦'}
                ：
                <a
                  href={`/highschool/${entry.prefectureId}/${entry.teamId}`}
                  className="underline text-blue-600 hover:text-blue-800 ml-1"
                >
                  {entry.team}
                </a>
                （{entry.result}）
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const filePath = path.join(
    process.cwd(),
    'data/highschool/prefecture-summary.json',
  );
  const json = fs.readFileSync(filePath, 'utf-8');
  const data: Entry[] = JSON.parse(json);

  return {
    props: {
      data,
    },
  };
};
