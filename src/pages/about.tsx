// src/pages/about.tsx
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';

export default function About() {
  const updatedAt = '2025年6月18日';

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
        />
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-12 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'このサイトについて', href: '/about' },
          ]}
        />

        <h1 className="text-3xl font-bold mb-8">このサイトについて</h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Softeni Pickとは</h2>
          <p className="text-base leading-relaxed">
            Softeni Pick（ソフテニ・ピック）は、ソフトテニス競技に関する選手情報・試合結果・大会データを整理し、誰でも簡単に閲覧・検索できることを目指した非公式の情報サイトです。
            全国の中学・高校・大学・社会人プレーヤーの試合履歴や戦績などを、独自に収集・整理して掲載しています。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">運営者について</h2>
          <p className="text-base leading-relaxed">
            運営者は、ソフトテニス経験者のITエンジニアです。学生時代の競技経験と、現在のウェブ開発・データ処理スキルを活かし、ソフトテニス界に貢献したいという想いで当サイトを開設しました。
            正確な情報の発信を心がけていますが、個人運営のため内容に誤りがある場合もあります。ご指摘いただけると幸いです。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">情報の収集方針</h2>
          <p className="text-base leading-relaxed">
            本サイトで掲載している情報は、公式サイト・大会要項・発表資料・SNS投稿・新聞記事などの公開情報をもとに、独自に構造化・整理したものです。
            正式な情報は、各大会主催者や所属団体の公式発表をご確認ください。
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">今後の展望</h2>
          <p className="text-base leading-relaxed">
            Softeni Pickでは、今後も各カテゴリ（高校・大学・社会人）の主要大会の情報を網羅し、競技者・指導者・ファンの皆様にとって役立つ情報基盤となることを目指しています。
            また、競技人口の増加や地域間・世代間の接続にも貢献できるよう、教育的・文化的価値の発信にも取り組んでいきます。
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">お問い合わせ・ご意見</h2>
          <p className="text-base leading-relaxed">
            データの修正依頼や掲載希望、ご意見などは、
            <a
              href="/contact"
              className="text-blue-600 dark:text-blue-400 underline"
            >
              お問い合わせフォーム
            </a>
            よりお送りください。誠実に対応させていただきます。
          </p>
        </section>

        <p className="text-xs text-right text-gray-500 mt-12">
          最終更新日: {updatedAt}
        </p>
      </main>
    </>
  );
}
