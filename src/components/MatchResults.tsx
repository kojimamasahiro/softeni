import styles from '@styles/Results.module.css';
import { PlayerData, MatchResult, Tournament } from '../types/types';

export default function MatchResults({ playerData }: { playerData: PlayerData }) {
  if (!playerData.matches || playerData.matches.length === 0) {
    return <p>試合結果がありません。</p>;
  }

  // ★ここ★ 大会名ごとにまとめる
  const tournamentsByName: { [name: string]: Tournament[] } = {};
  playerData.matches.forEach((tournament) => {
    if (!tournamentsByName[tournament.tournament]) {
      tournamentsByName[tournament.tournament] = [];
    }
    tournamentsByName[tournament.tournament].push(tournament);
  });

  return (
    <div>
      <h2 className={styles.sectionTitle}>🎾 大会結果</h2>
      {Object.entries(tournamentsByName).map(([tournamentName, tournaments], index) => (
        <div key={index} className={styles.tournament}>
          <h3 className={styles.subheading}>{tournamentName}</h3>

          {/* 代表の1件から基本情報を取得 */}
          {tournaments[0].dateRange && <div className={styles.meta}>📅 {tournaments[0].dateRange}</div>}
          {tournaments[0].location && <div className={styles.meta}>📍 {tournaments[0].location}</div>}
          {tournaments[0].link && (
            <div className={styles.meta}>
              🔗 <a href={tournaments[0].link} target="_blank" rel="noopener noreferrer">大会ページ</a>
            </div>
          )}
          {tournaments[0].finalResult && <div className={styles.meta}>🏁 最終結果：{tournaments[0].finalResult}</div>}

          {/* 各フォーマットに応じて表示 */}
          {tournaments.map((tournament, idx) => (
            <div key={idx}>
              {/* Combined */}
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
        </div>
      ))}
    </div>
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
