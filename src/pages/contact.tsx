import MetaHead from '@/components/MetaHead';

export default function Contact() {
  return (
    <>
      <MetaHead
        title="お問い合わせ | ソフトテニス情報"
        description="Softeni Pickへのお問い合わせはこちらのフォームよりお願いいたします。"
        url="https://softeni-pick.com/contact"
      />

      <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-100">
        <h1 className="text-3xl font-bold mb-8">お問い合わせ</h1>

        <p className="text-lg leading-relaxed mb-6">
          当サイトへのご質問・ご要望・掲載内容に関するお問い合わせは、以下のGoogleフォームよりお願いいたします。
        </p>

        <a
          href="https://forms.gle/A3xPcmiENHtgkskh7"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-blue-600 text-white px-5 py-3 rounded hover:bg-blue-700 transition"
        >
          Googleフォームを開く
        </a>
      </main>
    </>
  );
}
