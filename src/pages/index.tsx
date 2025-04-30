import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import LiveResultsByTournament from '@/components/LiveResultsByTournament';

interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
}

interface HomeProps {
  players: PlayerInfo[];
}

export default function Home({ players }: HomeProps) {
  return (
    <>
      <Head>
        <title>試合結果まとめ | ソフトテニス情報</title>
        <meta name="description" content="最新試合結果・大会情報・成績をまとめた非公式ファンサイトです。" />
        <meta property="og:title" content="試合結果まとめ" />
        <meta property="og:description" content="最新試合情報を随時更新中！" />
        <meta property="og:image" content="/public/images/og.png" />
        <meta property="og:url" content="https://yourdomain.com" />
        <meta property="og:type" content="website" />
      </Head>

      <div className={styles.container}>
        <h1 className={styles.title}>試合結果まとめ | ソフトテニス情報</h1>

        <LiveResultsByTournament playersData={players} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎾 選手一覧</h2>
          <div className={styles.playersList}>
            <div className={styles.playerCard}>
              <h2 className={styles.playerName}>上松 俊貴（うえまつ としき）</h2>
              <p className={styles.playerDescription}>NTT西日本所属</p>
              <Link href="/players/uematsu-toshiki/information" className={styles.link}>
                詳細を見る
              </Link>
            </div>
            <div className={styles.playerCard}>
              <h2 className={styles.playerName}>内田 理久（うちだ りく）</h2>
              <p className={styles.playerDescription}>NTT西日本所属</p>
              <Link href="/players/uchida-riku/information" className={styles.link}>
                詳細を見る
              </Link>
            </div>
            <div className={styles.playerCard}>
              <h2 className={styles.playerName}>内本 隆文（うちもと たかふみ）</h2>
              <p className={styles.playerDescription}>NTT西日本所属</p>
              <Link href="/players/uchimoto-takafumi/information" className={styles.link}>
                詳細を見る
              </Link>
            </div>
            <div className={styles.playerCard}>
              <h2 className={styles.playerName}>広岡 宙（ひろおか そら）</h2>
              <p className={styles.playerDescription}>NTT西日本所属</p>
              <Link href="/players/hirooka-sora/information" className={styles.link}>
                詳細を見る
              </Link>
            </div>
            {/* 他の選手も同様に追加できます */}
          </div>
        </section>
      </div>
    </>
  );
}

export async function getStaticProps() {
  const playersDir = path.join(process.cwd(), 'data/players');
  const playerIds = fs.readdirSync(playersDir);
  const players: PlayerInfo[] = [];

  for (const id of playerIds) {
    const filePath = path.join(playersDir, id, 'information.json');
    if (fs.existsSync(filePath)) {
      const jsonData = fs.readFileSync(filePath, 'utf-8');
      const playerData = JSON.parse(jsonData);
      players.push({ id, ...playerData });
    }
  }

  return {
    props: {
      players,
    },
  };
}