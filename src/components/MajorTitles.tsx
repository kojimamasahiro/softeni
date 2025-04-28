import styles from '../styles/Results.module.css';
import titlesData from '../../data/titles.json';
import { PlayerData } from '../types/types';

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

export default function MajorTitles({ playerData }: { playerData: PlayerData }) {
  if (!titlesData) {
    return <div>主要タイトルのデータがありません</div>;
  }

  // titlesDataから、各大会ごとにプレイヤーの結果を集める
  const majorTitles: MajorTitle[] = Object.entries(titlesData as TitlesData).map(([tournamentName, tournamentData]) => {
    const years = Object.entries(tournamentData.years)
      .map(([yearStr, yearData]: [string, TitleYearData]) => {
        const year = parseInt(yearStr, 10);

        if (yearData.status === 'scheduled') {
          return { year, result: yearData.scheduledDate || '(予定)' };
        } else if (yearData.status === 'canceled') {
          return { year, result: '(中止)' };
        } else if (yearData.status === 'completed') {
          const playerResult = yearData.results.find((r) => r.playerId === playerData.id);
          return { year, result: playerResult ? playerResult.result : '(出場なし)' };
        } else {
          return { year, result: 'ー' }; // 予備対応
        }
      });

    return {
      name: tournamentName,
      years,
    };
  });

  // 年度一覧をすべて取得してソート
  const allYears = Array.from(
    new Set(majorTitles.flatMap(title => title.years.map(y => y.year)))
  ).sort((a, b) => b - a); // 新しい順

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>🏆 主要タイトル</h2>
      <div className={styles.scrollTableWrapper}>
        <table className={styles.pivotTable}>
          <thead>
            <tr>
              <th>大会名</th>
              {allYears.map((year) => (
                <th key={year}>{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {majorTitles.map((title, index) => (
              <tr key={index}>
                <td>{title.name}</td>
                {allYears.map((year) => {
                  const found = title.years.find((y) => y.year === year);
                  return <td key={year}>{found?.result || 'ー'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
