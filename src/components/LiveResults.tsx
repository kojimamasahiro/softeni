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
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // "2025-04-28"

  const updatedDateStr = new Date((liveData as LiveData).updatedAt).toISOString().slice(0, 10);
  if (updatedDateStr !== todayStr) {
    return null; // 今日の日付と一致しない場合は何も表示しない
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
