// src/pages/contact.tsx
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

export default function Contact() {
  return (
    <>
      <MetaHead
        title="お問い合わせ | ソフトテニス情報"
        description="Softeni Pickへのお問い合わせはこちらのフォームよりお願いいたします。"
        url="https://softeni-pick.com/contact/"
      />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'お問い合わせ', href: '/contact' },
          ]}
        />

        <h1 className="text-3xl font-bold mb-8">お問い合わせ</h1>

        <p className="text-lg leading-relaxed mb-6">当サイトへのご質問・ご要望・掲載内容に関するお問い合わせは、以下のGoogleフォームよりお願いいたします。</p>

        <a
          href="https://forms.gle/A3xPcmiENHtgkskh7"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-primary text-white px-5 py-3 rounded hover:bg-blue-700 transition"
        >
          Googleフォームを開く
        </a>
      </PageLayout>
    </>
  );
}
