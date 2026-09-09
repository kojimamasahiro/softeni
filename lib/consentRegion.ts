// lib/consentRegion.ts
//
// Cookie 同意バナーを出す地域かどうかの判定。
//
// なぜ地域で分けるか:
// - 日本: 個人情報保護法は cookie 等の端末識別子（個人関連情報）について、自社の分析目的で
//   使う限りオプトイン同意を求めていない。電気通信事業法の外部送信規律も「同意 / オプトアウト /
//   通知・公表」のいずれかで足り、当サイトはプライバシーポリシーでの**公表**（/privacy の
//   「外部送信について」）で要件を満たす。よってバナーは不要。
// - EEA / 英国 / スイス: GDPR + ePrivacy で事前同意が必須なので、従来どおりバナーを出す。
//
// 判定手段はタイムゾーン。理由:
// - `next.config.mjs` は静的書き出しなのでサーバ側で地域を見て HTML を出し分けられない。
//   `/cdn-cgi/trace` を叩けば Cloudflare の正確な国判定が取れるが非同期で、初回 page_view
//   より前に同意状態を確定できない（= 同意済みでも初回PVが denied 計測になる問題が再発する）。
// - タイムゾーンは inline スクリプト内で**同期的に**読めるので、初回 page_view より前に確定できる。
// - 精度は落ちるが、外れ方が安全側に倒れる: 日本在住でも端末が Asia/Tokyo でなければ
//   「バナーを出す」（＝従来どおり）に落ちるだけ。逆に EEA 在住者の端末が Asia/Tokyo に
//   なっていることは実質起こらない。
//
// 注意: この定数は `src/pages/_app.tsx` の gtag 初期化 inline スクリプトからも参照している
// （あちらは React のハイドレーション前に走る必要があるため、判定式そのものは素の JS で
// 書き下してある）。判定を変えるときは両方を見ること。

/** バナー免除地域とみなすタイムゾーン。 */
export const CONSENT_EXEMPT_TIME_ZONE = 'Asia/Tokyo';

/**
 * 同意バナーを出さなくてよい地域からのアクセスか。
 * 判定できない環境（Intl が無い等）は false ＝ バナーを出す側に倒す。
 */
export function isConsentExemptRegion(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === CONSENT_EXEMPT_TIME_ZONE;
  } catch {
    return false;
  }
}
