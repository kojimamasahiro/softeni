// src/pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="ja">
        <Head>
          {/*
            描画前にサイドバーの保存状態を反映し、リロード時のチラつき（FOUC）を防ぐ。
            閉じた状態(sideNavOpen === 'false')のときだけ html に sidebar-collapsed を付与。
            CSS(globals.css)が PC でサイドバー幅を 0 に上書きする。React マウント後は
            AppShell がクラスを外し、以降は React 側の状態で制御する。
          */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){try{if(localStorage.getItem('sideNavOpen')==='false'){document.documentElement.classList.add('sidebar-collapsed');}}catch(e){}})();",
            }}
          />
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2626448782460921"
            crossOrigin="anonymous"
          ></script>

          <meta charSet="utf-8" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
          <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
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
