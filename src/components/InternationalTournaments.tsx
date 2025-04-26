import styles from '../styles/Results.module.css';

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
  results?: MatchResult[];
}

interface PlayerData {
  player: string;
  matches: Tournament[];
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

export default function InternationalTournaments({ playerData }: { playerData: PlayerData }) {
  // playerData.matchesが存在するか確認
  if (!playerData || !playerData.matches) {
    return <div>データがありません。</div>;
  }

  const internationalMatches = playerData.matches.filter(m => 
    m.location?.includes('韓国') || m.location?.includes('中国') || m.location?.includes('アジア') || m.location?.includes('世界')
  );

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>🌏 国際大会</h2>
      {internationalMatches.length > 0 ? (
        internationalMatches.map((tournament, index) => (
          <div key={index} className={styles.tournament}>
            <h3>{tournament.tournament}</h3>
            {tournament.dateRange && <div className={styles.meta}>日程：{tournament.dateRange}</div>}
            {tournament.location && <div className={styles.meta}>開催地：{tournament.location}</div>}
            {tournament.finalResult && <div className={styles.meta}>最終結果：{tournament.finalResult}</div>}
            {tournament.link && (
              <div className={styles.meta}>
                <a href={tournament.link} target="_blank" rel="noopener noreferrer">大会ページ</a>
              </div>
            )}

            {tournament.format === 'combined' && (
              <>
                {tournament.groupStage && (
                  <div className={styles.stage}>
                    <h4>グループステージ</h4>
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

            {tournament.format !== 'combined' && tournament.results && (
              <div className={styles.stage}>
                {renderTable(tournament.results)}
              </div>
            )}
          </div>
        ))
      ) : (
        <p>国際大会のデータがありません。</p>
      )}
    </section>
  );
}
