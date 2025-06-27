// src/pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="ja">
        <Head>
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2626448782460921"
            crossOrigin="anonymous"
          ></script>

          <meta charSet="utf-8" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
          <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
          <meta
            name="description"
            content="ソフトテニス選手の最新情報や試合結果をお届けするサイト"
          />
          <meta name="keywords" content="ソフトテニス, 試合結果, 大会, 選手" />
          <meta property="og:title" content="ソフトテニス選手情報サイト" />
          <meta
            property="og:description"
            content="ソフトテニス選手の最新情報や試合結果をお届けするサイト"
          />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="ソフトテニス選手情報サイト" />
          <meta name="twitter:card" content="summary_large_image" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
