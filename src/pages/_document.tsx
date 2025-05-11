// src/pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="ja">
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
          <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
          <meta name="description" content="ソフトテニス選手の最新情報や試合結果をお届けするサイト" />
          <meta name="keywords" content="ソフトテニス, 試合結果, 大会, 選手" />
          <meta property="og:title" content="ソフトテニス選手情報サイト" />
          <meta property="og:description" content="ソフトテニス選手の最新情報や試合結果をお届けするサイト" />
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
