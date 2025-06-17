// src/pages/about.tsx
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';
import { GetStaticProps } from 'next';

export default function About({ updatedAt }: { updatedAt: string }) {
  return (
    <>
      <MetaHead
        title="このサイトについて | ソフトテニス情報"
        description="このサイトは、ソフトテニス競技者の試合結果や大会情報をまとめて発信するサイトです。"
        url="https://softeni-pick.com/about"
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
                  "item": "https://softeni-pick.com/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "このサイトについて",
                  "item": "https://softeni-pick.com/about"
                }
              ]
            }),
          }}
        ></script>
      </Head>

      <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 shadow-lg rounded-lg">
        <h1 className="text-3xl font-extrabold mb-8 text-center">このサイトについて</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">運営者について</h2>
          <p className="text-lg leading-relaxed">
            Softeni Pickは、ソフトテニスの大会結果や選手情報を整理し、競技者・保護者・指導者など関係者が競技理解を深められるよう設計された情報提供サイトです。
          </p>
          <p className="text-lg leading-relaxed mt-2">
            運営者は元選手として競技に携わった経験を活かし、データと記録のアーカイブを通してソフトテニスの魅力を伝えることを目指しています。
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

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">よくあるご質問</h2>
          <p className="text-lg leading-relaxed font-semibold">Q. このサイトの情報は正確ですか？</p>
          <p className="text-lg leading-relaxed mb-4">A. 正式な大会結果や公開情報をもとに整理していますが、正確性の保証はできかねます。必ず公式情報もご確認ください。</p>

          <p className="text-lg leading-relaxed font-semibold">Q. データの使用は自由ですか？</p>
          <p className="text-lg leading-relaxed">A. 非営利目的での利用は自由ですが、転載・再配布の際は出典を明記してください。</p>
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

        <p className="text-xs text-right text-gray-500 mt-8">
          最終更新日: {updatedAt}
        </p>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const updatedAt = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    props: {
      updatedAt,
    },
  };
};
