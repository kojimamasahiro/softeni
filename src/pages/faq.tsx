// src/pages/faq.tsx
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';

export default function FAQ() {
    return (
        <>
            <MetaHead
                title="よくあるご質問 | ソフトテニス情報"
                description="Softeni Pickに関してよく寄せられるご質問とその回答をまとめています。"
                url="https://softeni-pick.com/faq"
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
                                    "name": "よくあるご質問",
                                    "item": "https://softeni-pick.com/faq"
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
                        { label: 'よくあるご質問', href: '/faq' },
                    ]}
                />

                <h1 className="text-3xl font-bold mb-8">よくあるご質問</h1>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Q. 掲載情報はどこから取得していますか？</h2>
                    <p>主に各大会の公開情報や学校・選手のSNS、公式発表をもとに、手動または自動収集・整理しています。</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Q. 情報の修正依頼はできますか？</h2>
                    <p>はい。誤記や変更がある場合は、お問い合わせフォームよりお知らせください。</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Q. データの利用は自由ですか？</h2>
                    <p>個人の非営利利用に限り、掲載データの活用は可能です。商用利用を希望される場合はご相談ください。</p>
                </section>
            </main>
        </>
    );
}
