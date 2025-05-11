import { useEffect, useState } from 'react';
import { AppProps } from 'next/app';
import Script from 'next/script';
import '@/styles/globals.css';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import CookieConsent from '@/components/CookieConsent';

export default function App({ Component, pageProps }: AppProps) {
  const [hasConsent, setHasConsent] = useState(false);

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
    }
  }, []);

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
        ad_storage: 'denied',
        analytics_storage: 'denied',
      });
    }
  };

  return (
    <>
      {/* Googleタグの読み込みと Consent Mode の初期化 */}
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              analytics_storage: 'denied'
            });
            gtag('js', new Date());
            gtag('config', 'G-1K5LX0RGJ7');
          `,
        }}
      />
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-1K5LX0RGJ7"
        strategy="afterInteractive"
      />

      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>

      {/* 同意バナー */}
      {!hasConsent && (
        <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />
      )}
    </>
  );
}
