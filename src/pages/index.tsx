import Link from 'next/link';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';

export default function Home() {
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
        <div className={styles.playersList}>
          <div className={styles.playerCard}>
            <h2 className={styles.playerName}>上松俊貴</h2>
            <p className={styles.playerDescription}>NTT西日本所属</p>
            <Link href="/players/uematsu-toshiki/results" className={styles.link}>
              詳細を見る
            </Link>
          </div>
          <div className={styles.playerCard}>
            <h2 className={styles.playerName}>内田理久</h2>
            <p className={styles.playerDescription}>NTT西日本所属</p>
            <Link href="/players/uchida-riku/results" className={styles.link}>
              詳細を見る
            </Link>
          </div>
          {/* 他の選手も同様に追加できます */}
        </div>
      </div>
    </>
  );
}
