import styles from '../styles/Results.module.css';

interface YearResult {
  year: number;
  result: string;
}

interface MajorTitle {
  name: string;
  years: YearResult[];
}

interface PlayerData {
  majorTitles: MajorTitle[];
}

export default function MajorTitles({ playerData }: { playerData: PlayerData }) {
  if (!playerData || !Array.isArray(playerData.majorTitles)) {
    return <div>主要タイトルのデータがありません</div>;
  }

  // 年度一覧をすべて取得してソート
  const allYears = Array.from(
    new Set(playerData.majorTitles.flatMap(title => title.years.map(y => y.year)))
  ).sort((a, b) => b - a); // 新しい順に

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
            {playerData.majorTitles.map((title, index) => (
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
