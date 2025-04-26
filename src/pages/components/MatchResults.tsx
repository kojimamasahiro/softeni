import styles from '../../styles/Results.module.css';

interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
}

interface Stage {
  format: 'round-robin' | 'tournament';
  group?: string;
  results: MatchResult[];
}

interface Tournament {
  tournament: string;
  dateRange?: string;
  location?: string;
  link?: string;
  format: 'round-robin' | 'tournament' | 'combined';
  finalResult?: string;
  groupStage?: Stage;
  finalStage?: Stage;
  results?: MatchResult[]; // 単独用
}

interface PlayerData {
  matches: Tournament[];
}

export default function MatchResults({ playerData }: { playerData: PlayerData }) {
  if (!playerData.matches || playerData.matches.length === 0) {
    return <p>試合結果がありません。</p>;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>🎾 大会結果</h2>
      {playerData.matches.map((tournament, index) => (
        <div key={index} className={styles.tournament}>
          <h3 className={styles.subheading}>{tournament.tournament}</h3>
          {tournament.dateRange && <div className={styles.meta}>📅 {tournament.dateRange}</div>}
          {tournament.location && <div className={styles.meta}>📍 {tournament.location}</div>}
          {tournament.link && (
            <div className={styles.meta}>
              🔗 <a href={tournament.link} target="_blank" rel="noopener noreferrer">大会ページ</a>
            </div>
          )}
          {tournament.finalResult && <div className={styles.meta}>🏁 最終結果：{tournament.finalResult}</div>}

          {/* Combined フォーマット */}
          {tournament.format === 'combined' && (
            <>
              {tournament.groupStage && (
                <div className={styles.stage}>
                  <h4>グループステージ（{tournament.groupStage.group || 'グループ'}）</h4>
                  {renderTable(tournament.groupStage.results)}
                </div>
              )}
              {tournament.finalStage && (
                <div className={styles.stage}>
                  <h4>決勝トーナメント</h4>
                  {renderTable(tournament.finalStage.results)}
                </div>
              )}
            </>
          )}

          {/* 単独トーナメント */}
          {tournament.format === 'tournament' && tournament.results && (
            <div className={styles.stage}>
              <h4>トーナメント</h4>
              {renderTable(tournament.results)}
            </div>
          )}

          {/* 単独ラウンドロビン */}
          {tournament.format === 'round-robin' && tournament.results && (
            <div className={styles.stage}>
              <h4>ラウンドロビン</h4>
              {renderTable(tournament.results)}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function renderTable(results: MatchResult[]) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>ラウンド</th>
          <th>対戦相手</th>
          <th>スコア</th>
          <th>勝敗</th>
        </tr>
      </thead>
      <tbody>
        {results.map((match, i) => (
          <tr key={i}>
            <td>{match.round}</td>
            <td>{match.opponent}</td>
            <td>{match.score}</td>
            <td>{match.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
