import styles from '@/styles/Results.module.css';
import liveData from '@/data/live.json';

interface LiveData {
  tournament: string;
  updatedAt: string;
  players: Players[];
}

interface Players {
  playerId: string;
  status: string;
  latestResult: string;
  nextMatch: string;
}

export default function LiveResultsByTournament() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // "2025-04-28"

  const updatedDateStr = new Date((liveData as LiveData).updatedAt).toISOString().slice(0, 10);
  if (updatedDateStr !== todayStr) {
    return null; // 今日の日付と一致しない場合は何も表示しない
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>🎾 大会速報</h2>
      <div className={styles.tournamentBlock}>
        <h3 className={styles.tournamentTitle}>{liveData.tournament}</h3>
        <ul className={styles.liveResultList}>
          {liveData.players.map((player, index) => (
            <li key={index}>
              <strong>{player.playerId}</strong>：{player.latestResult}（次: {player.nextMatch}）
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
