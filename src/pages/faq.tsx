// src/pages/faq.tsx
import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

export default function FAQ() {
  return (
    <>
      <MetaHead
        title="よくあるご質問 | ソフトテニス情報"
        description="Softeni Pickに関してよく寄せられるご質問とその回答をまとめています。"
        url="https://softeni-pick.com/faq/"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'よくあるご質問',
                  item: 'https://softeni-pick.com/faq/',
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: '掲載情報はどこから取得していますか？',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: '主に各大会の公開情報や学校・選手のSNS、公式発表をもとに、手動または自動収集・整理しています。',
                  },
                },
                {
                  '@type': 'Question',
                  name: '情報の修正依頼はできますか？',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'はい。誤記や変更がある場合は、お問い合わせフォームよりお知らせください。',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'データの利用は自由ですか？',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: '個人の非営利利用に限り、掲載データの活用は可能です。商用利用を希望される場合はご相談ください。',
                  },
                },
                {
                  '@type': 'Question',
                  name: '個別の選手ページがある選手とない選手がいるのはなぜですか？',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: '一定数以上の試合記録が確認できる選手について、これまでの戦績をまとめた個別ページを作成しています。記録が少ない選手は、検索結果などに名前は表示されますが個別ページは作成していません。今後試合データが増えれば、自動的に個別ページが作成される場合があります。',
                  },
                },
                {
                  '@type': 'Question',
                  name: '自分の情報を掲載しないでほしいのですが。',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'お問い合わせフォームよりご連絡ください。掲載の停止・削除に対応します。',
                  },
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'よくあるご質問', href: '/faq' },
          ]}
        />

        <h1 className="text-3xl font-bold mb-8">よくあるご質問</h1>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Q. 掲載情報はどこから取得していますか？
          </h2>
          <p>
            主に各大会の公開情報や学校・選手のSNS、公式発表をもとに、手動または自動収集・整理しています。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Q. 情報の修正依頼はできますか？
          </h2>
          <p>
            はい。誤記や変更がある場合は、お問い合わせフォームよりお知らせください。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Q. データの利用は自由ですか？
          </h2>
          <p>
            個人の非営利利用に限り、掲載データの活用は可能です。商用利用を希望される場合はご相談ください。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Q. 個別の選手ページがある選手とない選手がいるのはなぜですか？
          </h2>
          <p>
            一定数以上の試合記録が確認できる選手について、これまでの戦績をまとめた個別ページを作成しています。記録が少ない選手は、検索結果などに名前は表示されますが個別ページは作成していません。今後試合データが増えれば、自動的に個別ページが作成される場合があります。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Q. 自分の情報を掲載しないでほしいのですが。
          </h2>
          <p>
            お問い合わせフォームよりご連絡ください。掲載の停止・削除に対応します。
          </p>
        </section>
      </PageLayout>
    </>
  );
}
