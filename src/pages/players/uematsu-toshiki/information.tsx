import Link from 'next/link';
import styles from '@/styles/Players.module.css';

const UematsuToshikiInformation = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>上松俊貴選手 - プロフィール</h1>

      <section className={styles.profile}>
        <h2 className={styles.heading}>プロフィール</h2>
        <p>上松俊貴選手は、ソフトテニスの日本代表選手で、国内外の大会で数々の実績を持っています。</p>
      </section>

      <section className={styles.results}>
        <h2 className={styles.heading}>大会結果</h2>
        <p>現在、上松選手の最新の大会結果はここに表示されます。</p>
        {/* 試合結果や大会の情報を後から追加する部分 */}
      </section>

      <section className={styles.links}>
        <h2 className={styles.heading}>関連リンク</h2>
        <ul className={styles.link}>
          <li className={styles.item}>
            <Link href="https://x.com/toshipon_0611" target="_blank" rel="noopener noreferrer">X(旧Twitter)</Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default UematsuToshikiInformation;
