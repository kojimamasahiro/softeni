import { AppProps } from 'next/app';
import Script from 'next/script';
import '../styles/globals.css'; // これは自分のスタイルパスに合わせて！

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-1K5LX0RGJ7"
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1K5LX0RGJ7');
          `,
        }}
      />
      {/* アプリ本体 */}
      <Component {...pageProps} />
    </>
  );
}
