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
          {/*
            AdSense (Auto ads) script は next/script (_app.tsx, strategy="lazyOnload") へ移設。
            ここに async script として直接置くと、React のハイドレーション完了前に
            Auto ads が DOM へ広告枠を挿入し、ハイドレーション不一致 (Minified React error #418)
            → 直後に adsbygoogle 側 "Error: no_div" を誘発することがある。
            (2026-07-05: 本番で発生した #418 / no_div の原因調査より)
          */}

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
