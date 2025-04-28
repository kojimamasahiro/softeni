import Link from 'next/link';
import styles from '@/styles/Information.module.css';

const UchidaRikuInformation = () => {
  const name = '内田 理久（うちだ りく）';
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{name} - プロフィール</h1>

      <section className={styles.profile}>
        <h2 className={styles.heading}>プロフィール</h2>
        <table className={styles.profileTable}>
          <tbody>
            <tr>
              <th>所属</th>
              <td>NTT西日本</td>
            </tr>
            <tr>
              <th>誕生日</th>
              <td>1998年5月25日</td>
            </tr>
            <tr>
              <th>身長</th>
              <td>180cm</td>
            </tr>
            <tr>
              <th>利き手</th>
              <td>左</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.results}>
        <h2 className={styles.heading}>大会結果</h2>
        <Link href="/players/uchida-riku/results" className={styles.link}>
          詳細を見る
        </Link>
      </section>

      <section className={styles.links}>
        <h2 className={styles.heading}>関連リンク</h2>
        <ul className={styles.link}>
          <li className={styles.item}>
            <Link href="https://www.instagram.com/uchida.riku0525/" target="_blank" rel="noopener noreferrer">Instagram</Link>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default UchidaRikuInformation;
