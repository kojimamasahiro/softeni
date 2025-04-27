import styles from '../styles/About.module.css';

export default function About() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>このサイトについて</h1>

      <section className={styles.section}>
        <h2 className={styles.subheading}>運営者について</h2>
        <p>このサイトは、ソフトテニス競技者の試合結果や大会情報をまとめ、ファンや関係者の皆様に向けて発信することを目的としています。</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>著作権・注意事項</h2>
        <p>当サイトに掲載されている文章・画像・データ等の著作権は、各権利所有者に帰属します。</p>
        <p>問題のある掲載内容がございましたら、お手数ですが<a href="https://forms.gle/A3xPcmiENHtgkskh7" target="_blank" rel="noopener noreferrer">こちらのフォーム</a>よりご連絡ください。迅速に対応いたします。</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>免責事項</h2>
        <p>当サイトに掲載している情報は、できる限り正確なものを提供するよう努めていますが、正確性や最新性を保証するものではありません。</p>
        <p>当サイトの利用によって生じた損害等については、一切の責任を負いかねますのでご了承ください。</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>プライバシーポリシーの変更について</h2>
        <p>当サイトは、必要に応じてプライバシーポリシーを変更することがあります。</p>
        <p>変更後のプライバシーポリシーは、本ページにて速やかに公開いたします。</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subheading}>お問い合わせ</h2>
        <p><a href="https://forms.gle/A3xPcmiENHtgkskh7" target="_blank" rel="noopener noreferrer">こちらのフォーム</a>よりご連絡ください。</p>
      </section>
    </div>
  );
}
