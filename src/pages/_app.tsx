import CookieConsent from '@/components/CookieConsent';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import '@/styles/globals.css';
import { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect, useState } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function App({ Component, pageProps }: AppProps) {
  const [hasConsent, setHasConsent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const accepted = localStorage.getItem('cookieConsent');
    if (accepted === 'true') {
      setHasConsent(true);
      if (window.gtag) {
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          analytics_storage: 'granted',
        });
      }
    } else {
      // 同意しない場合は default に設定（cookieless計測を有効化）
      if (window.gtag) {
        window.gtag('consent', 'update', {
          ad_storage: 'default',
          analytics_storage: 'default',
        });
      }
    }

    const handleRouteChange = (url: string) => {
      if (window.gtag) {
        window.gtag('config', GA_ID, {
          page_path: url,
        });
      }
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  const handleAccept = () => {
    setHasConsent(true);
    localStorage.setItem('cookieConsent', 'true');
    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        analytics_storage: 'granted',
      });
    }
  };

  const handleDecline = () => {
    setHasConsent(false);
    localStorage.setItem('cookieConsent', 'false');
    if (window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'default',       // denied → default に変更
        analytics_storage: 'default', // denied → default に変更
      });
    }
  };

  return (
    <>
      {/* gtag.jsの読み込み */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* 初期設定（Consent Modeを含む） */}
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'default',
              analytics_storage: 'default'
            });
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />

      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>

      {!hasConsent && (
        <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />
      )}
    </>
  );
}
