// global.d.ts
export {};

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    /** AdSense の push キュー。スクリプト読込前は配列として積まれる（src/components/AdUnit.tsx）。 */
    adsbygoogle?: Record<string, unknown>[];
  }
}
