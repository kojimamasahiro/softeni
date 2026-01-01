// src/pages/_app.tsx
import '@/styles/globals.css';

import { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect, useState } from 'react';

import AffiliateLink from '@/components/AffiliateLink';
import CookieConsent from '@/components/CookieConsent';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export default function App({ Component, pageProps }: AppProps) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  const [hasConsent, setHasConsent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!GA_ID) return;

    const accepted = localStorage.getItem('cookieConsent');
    if (accepted === 'true') {
      setHasConsent(true);
      window.gtag?.('consent', 'update', {
        ad_storage: 'granted',
        analytics_storage: 'granted',
      });
    }

    const handleRouteChange = (url: string) => {
      window.gtag?.('config', GA_ID, {
        page_path: url,
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
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                analytics_storage: 'denied'
              });
              gtag('js', new Date());
              gtag('config', '${GA_ID}', {
                page_path: window.location.pathname,
                cookie_flags: 'SameSite=None;Secure'
              });
            `}
          </Script>
        </>
      )}

      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
        <AffiliateLink />
        <Footer />
      </div>

      {!hasConsent && (
        <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />
      )}
    </>
  );
}
