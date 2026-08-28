// global.d.ts
export {};

declare global {
  interface Window {
    /**
     * gtag.js のコマンドキュー（src/pages/_app.tsx で読み込む）。
     * 引数はコマンドごとに異なる（config は測定ID+設定、event はイベント名+パラメータ、
     * consent は 'default' | 'update' + 同意状態）ため可変長。戻り値は使わないので unknown で足りる。
     */
    gtag: (command: 'config' | 'set' | 'js' | 'event' | 'consent', ...args: unknown[]) => void;
    /** AdSense の push キュー。スクリプト読込前は配列として積まれる（src/components/AdUnit.tsx）。 */
    adsbygoogle?: Record<string, unknown>[];
  }
}
