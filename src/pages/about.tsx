import MetaHead from '@/components/MetaHead';
import Head from 'next/head';

export default function About() {
  return (
    <>
      <MetaHead
        title="このサイトについて | ソフトテニス情報"
        description="このサイトは、ソフトテニス競技者の試合結果や大会情報をまとめて発信するサイトです。"
        url="https://softeni.vercel.app/about"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "ホーム",
                  "item": "https://softeni.vercel.app/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "このサイトについて",
                  "item": "https://softeni.vercel.app/about"
                }
              ]
            }),
          }}
        ></script>
      </Head>

      <div className="max-w-4xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 shadow-lg rounded-lg">
        <h1 className="text-3xl font-extrabold mb-8 text-center">このサイトについて</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">運営者について</h2>
          <p className="text-lg leading-relaxed">
            このサイトは、ソフトテニス競技者の試合結果や大会情報をまとめ、ファンや関係者の皆様に向けて発信することを目的としています。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">著作権・注意事項</h2>
          <p className="text-lg leading-relaxed">
            当サイトに掲載されている文章・画像・データ等の著作権は、各権利所有者に帰属します。
          </p>
          <p className="text-lg leading-relaxed">
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

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">免責事項</h2>
          <p className="text-lg leading-relaxed">
            当サイトに掲載している情報は、できる限り正確なものを提供するよう努めていますが、正確性や最新性を保証するものではありません。
          </p>
          <p className="text-lg leading-relaxed">
            当サイトの利用によって生じた損害等については、一切の責任を負いかねますのでご了承ください。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">プライバシーポリシーの変更について</h2>
          <p className="text-lg leading-relaxed">
            当サイトは、必要に応じてプライバシーポリシーを変更することがあります。
          </p>
          <p className="text-lg leading-relaxed">
            変更後のプライバシーポリシーは、本ページにて速やかに公開いたします。
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">お問い合わせ</h2>
          <p className="text-lg leading-relaxed">
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
    </>
  );
}
