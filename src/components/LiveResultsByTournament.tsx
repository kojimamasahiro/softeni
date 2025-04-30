import styles from '@/styles/Results.module.css';
import playersData from '@/data/players.json';
import liveData from '@/data/live.json';

interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
  height: number;
  handedness: string;
}

export default function LiveResultsByTournament() {
  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedAtJST = new Date(liveData.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  if (updatedAtJST !== todayJST) {
    return null; // 日本時間での今日でなければ非表示
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>🎾 大会速報</h2>
      <div className={styles.tournamentBlock}>
        <h3 className={styles.tournamentTitle}>{liveData.tournament}</h3>
        <ul className={styles.liveResultList}>
          {liveData.players.map((player, index) => {
            const playerInfo = (playersData as PlayerInfo[]).find(p => p.id === player.playerId);
            const playerName = playerInfo ? `${playerInfo.lastName}${playerInfo.firstName}` : player.playerId;

            return (
              <li key={index}>
                <strong>{playerName}</strong>：{player.latestResult}（次: {player.nextMatch}）
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
