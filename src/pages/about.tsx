export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-gray-800 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-8 text-center">このサイトについて</h1>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">運営者について</h2>
        <p>
          このサイトは、ソフトテニス競技者の試合結果や大会情報をまとめ、
          ファンや関係者の皆様に向けて発信することを目的としています。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">著作権・注意事項</h2>
        <p>
          当サイトに掲載されている文章・画像・データ等の著作権は、
          各権利所有者に帰属します。
        </p>
        <p>
          問題のある掲載内容がございましたら、
          <a
            href="https://forms.gle/A3xPcmiENHtgkskh7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline"
          >
            こちらのフォーム
          </a>
          よりご連絡ください。迅速に対応いたします。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">免責事項</h2>
        <p>
          当サイトに掲載している情報は、できる限り正確なものを提供するよう努めていますが、
          正確性や最新性を保証するものではありません。
        </p>
        <p>
          当サイトの利用によって生じた損害等については、
          一切の責任を負いかねますのでご了承ください。
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">プライバシーポリシーの変更について</h2>
        <p>当サイトは、必要に応じてプライバシーポリシーを変更することがあります。</p>
        <p>変更後のプライバシーポリシーは、本ページにて速やかに公開いたします。</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">お問い合わせ</h2>
        <p>
          <a
            href="https://forms.gle/A3xPcmiENHtgkskh7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline"
          >
            こちらのフォーム
          </a>
          よりご連絡ください。
        </p>
      </section>
    </div>
  );
}
