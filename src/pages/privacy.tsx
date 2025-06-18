// src/pages/privacy.tsx
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';
import Breadcrumbs from '@/components/Breadcrumb';

export default function PrivacyPolicy() {
    return (
        <>
            <MetaHead
                title="プライバシーポリシー | ソフトテニス情報"
                description="Softeni Pickのプライバシーポリシー。アクセス解析や広告に関する情報を掲載しています。"
                url="https://softeni-pick.com/privacy"
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
                                    "name": "プライバシーポリシー",
                                    "item": "https://softeni-pick.com/privacy"
                                }
                            ]
                        }),
                    }}
                />
            </Head>

            <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-100">
                <Breadcrumbs
                    crumbs={[
                        { label: 'ホーム', href: '/' },
                        { label: 'プライバシーポリシー', href: '/players' },
                    ]}
                />

                <h1 className="text-3xl font-bold mb-8">プライバシーポリシー</h1>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">1. 個人情報の利用目的</h2>
                    <p>当サイトでは、お問い合わせ時に氏名やメールアドレス等の個人情報を入力いただく場合があります。これらの情報は、回答や必要な情報を電子メールなどでご連絡する場合に利用させていただくものであり、これ以外の目的では使用しません。</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">2. アクセス解析ツールについて</h2>
                    <p>当サイトでは、Google Analytics を利用してアクセス解析を行っています。Google Analytics はトラフィックデータの収集のために Cookie を使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">3. 広告について</h2>
                    <p>当サイトでは、第三者配信の広告サービス（Google AdSense など）を利用する予定です。これらの広告配信事業者は、ユーザーの興味に応じた広告を表示するため Cookie を使用することがあります。</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">4. 免責事項</h2>
                    <p>当サイトからリンクやバナーなどによって他サイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">5. プライバシーポリシーの変更について</h2>
                    <p>当サイトは、法令の改正や運営方針の変更に伴い、プライバシーポリシーを変更することがあります。変更後の内容は本ページにて速やかに公開いたします。</p>
                </section>
            </main>
        </>
    );
}