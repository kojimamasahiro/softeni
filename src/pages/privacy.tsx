// src/pages/privacy.tsx
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

/**
 * 「4. 外部送信について」は電気通信事業法の外部送信規律に基づく公表。
 * 日本からのアクセスに同意バナーを出さない運用（lib/consentRegion.ts）は、
 * この節の公表があって初めて成り立つ。片方だけ変えないこと。
 */
const EXTERNAL_TRANSMISSIONS = [
  {
    name: 'Google アナリティクス（GA4）',
    provider: 'Google LLC',
    purpose: 'サイトの利用状況の分析・改善',
    items: 'Cookie に保存された識別子、閲覧したページの URL、参照元、IP アドレス、ブラウザ・端末の情報',
    policyUrl: 'https://policies.google.com/privacy?hl=ja',
  },
  {
    name: 'Google AdSense',
    provider: 'Google LLC',
    purpose: '広告の配信・表示、広告効果の測定',
    items: 'Cookie に保存された識別子、閲覧したページの URL、IP アドレス、ブラウザ・端末の情報',
    policyUrl: 'https://policies.google.com/technologies/ads?hl=ja',
  },
];

export default function PrivacyPolicy() {
  return (
    <>
      <MetaHead
        title="プライバシーポリシー | ソフトテニス情報"
        description="Softeni Pickのプライバシーポリシー。アクセス解析・広告・外部送信される情報について掲載しています。"
        url="https://softeni-pick.com/privacy/"
      />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'プライバシーポリシー', href: '/privacy' },
          ]}
        />

        <h1 className="text-3xl font-bold mb-8">プライバシーポリシー</h1>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">1. 個人情報の利用目的</h2>
          <p>
            当サイトでは、お問い合わせ時に氏名やメールアドレス等の個人情報を入力いただく場合があります。これらの情報は、回答や必要な情報を電子メールなどでご連絡する場合に利用させていただくものであり、これ以外の目的では使用しません。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">2. アクセス解析ツールについて</h2>
          <p>
            当サイトでは、Google アナリティクス（GA4）を利用してアクセス解析を行っています。Google アナリティクスはトラフィックデータの収集のために Cookie
            を使用します。収集されるデータは匿名で、個人を特定するものではありません。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">3. 広告について</h2>
          <p>
            当サイトでは、第三者配信の広告サービス（Google AdSense）を利用しています。これらの広告配信事業者は、ユーザーの興味に応じた広告を表示するため Cookie
            を使用することがあります。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">4. 外部送信について</h2>
          <p className="mb-3">当サイトを閲覧された際、以下のとおり利用者の端末から外部の事業者へ情報が送信されます（電気通信事業法第27条の12に基づく公表）。</p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left align-bottom">
                  <th className="py-2 pr-4 font-semibold">送信先・サービス</th>
                  <th className="py-2 pr-4 font-semibold">利用目的</th>
                  <th className="py-2 font-semibold">送信される情報</th>
                </tr>
              </thead>
              <tbody>
                {EXTERNAL_TRANSMISSIONS.map((t) => (
                  <tr key={t.name} className="border-b border-gray-200 align-top">
                    <td className="py-2 pr-4">
                      <span className="block">{t.name}</span>
                      <span className="block text-xs text-gray-600">{t.provider}</span>
                      <a href={t.policyUrl} className="text-xs underline text-blue-700 hover:text-blue-900" target="_blank" rel="noopener noreferrer">
                        プライバシーポリシー
                      </a>
                    </td>
                    <td className="py-2 pr-4">{t.purpose}</td>
                    <td className="py-2">{t.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">5. Cookie の利用と停止方法</h2>
          <p className="mb-3">
            日本国内からのアクセスでは、上記の内容を本ページで公表したうえで、Cookie
            を利用したアクセス解析および広告配信を行っています。欧州経済領域（EEA）・英国・スイスからのアクセスでは、Cookie
            の利用について事前に同意を求めるバナーを表示し、同意いただけない場合は解析・広告用の Cookie を使用しません。
          </p>
          <p>Cookie の利用を停止したい場合は、次のいずれかの方法をご利用いただけます。</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <a
                href="https://tools.google.com/dlpage/gaoptout?hl=ja"
                className="underline text-blue-700 hover:text-blue-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google アナリティクス オプトアウト アドオン
              </a>
              をブラウザに導入する
            </li>
            <li>
              <a href="https://myadcenter.google.com/" className="underline text-blue-700 hover:text-blue-900" target="_blank" rel="noopener noreferrer">
                Google の広告設定
              </a>
              でパーソナライズド広告を無効にする
            </li>
            <li>お使いのブラウザの設定で Cookie を無効にする</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">6. 免責事項</h2>
          <p>当サイトからリンクやバナーなどによって他サイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. プライバシーポリシーの変更について</h2>
          <p>当サイトは、法令の改正や運営方針の変更に伴い、プライバシーポリシーを変更することがあります。変更後の内容は本ページにて速やかに公開いたします。</p>
        </section>
      </PageLayout>
    </>
  );
}
