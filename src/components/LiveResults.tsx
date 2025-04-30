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

export default function LiveResults({ playerId }: { playerId: string }) {
  const todayJST = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const updatedAtJST = new Date(liveData.updatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  if (updatedAtJST !== todayJST) {
    return null; // 日本時間での今日でなければ非表示
  }

  const playerLiveResult = ((liveData as LiveData).players as Players[]).find(
    (player) => player.playerId === playerId
  );

  if (!playerLiveResult) {
    return null; // 速報がなければ何も表示しない
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>🎾 大会速報</h2>
      <div className={styles.liveResultCard}>
        <p><strong>大会名:</strong> {liveData.tournament}</p>
        <p><strong>現在の状況:</strong> {playerLiveResult.status}</p>
        <p><strong>最新結果:</strong> {playerLiveResult.latestResult}</p>
        <p><strong>次の試合:</strong> {playerLiveResult.nextMatch}</p>
        <p className={styles.updatedAt}>最終更新: {new Date(liveData.updatedAt).toLocaleString('ja-JP')}</p>
      </div>
    </section>
  );
}
