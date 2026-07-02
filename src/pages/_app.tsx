// src/pages/_app.tsx
import '@/styles/globals.css';

import { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect, useState } from 'react';

// import AffiliateLink from '@/components/AffiliateLink';
import AppShell from '@/components/AppShell';
import CookieConsent from '@/components/CookieConsent';
import Footer from '@/components/Footer';

export default function App({ Component, pageProps }: AppProps) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  const [hasConsent, setHasConsent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!GA_ID) return;

    // 同意状態の「復元」は inline スクリプト側で初回 page_view より前に行う。
    // ここではバナー表示の制御のみを担当する（計測には影響させない）。
    if (localStorage.getItem('cookieConsent') === 'true') {
      setHasConsent(true);
    }

    // SPA 遷移は config の再実行ではなく page_view イベントで送る
    // （config 再実行による二重計上 / セッション分断を避ける）。
    const handleRouteChange = (url: string) => {
      window.gtag?.('event', 'page_view', {
        page_path: url,
        page_location: window.location.href,
        page_title: document.title,
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, GA_ID]);

  const handleAccept = () => {
    setHasConsent(true);
    localStorage.setItem('cookieConsent', 'true');
    window.gtag?.('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
    });
  };

  const handleDecline = () => {
    setHasConsent(false);
    localStorage.setItem('cookieConsent', 'false');
    window.gtag?.('consent', 'update', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
    });
  };

  return (
    <>
      {/* GA ID があるときだけ読み込む */}
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}

              // デフォルトは denied。wait_for_update でバナー操作 / 復元を
              // 取りこぼさないよう少し待つ。
              gtag('consent', 'default', {
                ad_storage: 'denied',
                analytics_storage: 'denied',
                wait_for_update: 500
              });

              // 再訪ユーザーは初回 page_view より前に同意を復元する。
              // これをしないと「同意済みなのに初回PVだけ denied 計測」になる。
              try {
                if (localStorage.getItem('cookieConsent') === 'true') {
                  gtag('consent', 'update', {
                    ad_storage: 'granted',
                    analytics_storage: 'granted'
                  });
                }
              } catch (e) {}

              // クッキー不可の環境でも計測ロスを抑える設定。
              gtag('set', 'url_passthrough', true);
              gtag('set', 'ads_data_redaction', true);

              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                page_path: window.location.pathname,
                cookie_flags: 'SameSite=Lax;Secure'
              });
            `}
          </Script>
        </>
      )}

      <AppShell footer={<Footer />}>
        <Component {...pageProps} />
        {/* <AffiliateLink /> */}
      </AppShell>

      {!hasConsent && <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />}
    </>
  );
}
