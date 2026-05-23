# Monetization

## 概要

このリポジトリ内で確認できた収益化関連は、主に以下です。

- Google AdSense
- Google Analytics
- アフィリエイト導線
- Android アプリ `AdInsight` の紹介サイト上の課金言及

## Web 広告

### AdSense

- `src/pages/_document.tsx` で AdSense スクリプトを全体読込
- `public/ads.txt`
- `public/app-ads.txt`

補足:

- 広告枠コンポーネントの網羅確認までは未実施
- 少なくとも AdSense 読込はドキュメント全体で有効化されている

### アフィリエイト

- `src/components/AffiliateLink.tsx` に もしもアフィリエイト実装あり
- ただし `src/pages/_app.tsx` ではコメントアウトされており、現状は常時表示されていない

## 計測

- `src/pages/_app.tsx` で Google Analytics を読込
- Cookie 同意 UI は `src/components/CookieConsent.tsx`
- 同意前は `ad_storage` / `analytics_storage` を denied
- 同意後に granted へ更新

## プライバシー・法務

- `src/pages/privacy.tsx` に広告・アクセス解析の説明あり
- ここには「Google AdSense などを利用予定」との文言がある

## Android / AdInsight 側

- `adinsight-site/index.html` に `Google Play Billing` の文言あり
- ただし Android アプリ本体コードはこのリポジトリでは未確認

## Assumption

- Web 本体の主収益化は AdSense と一部アフィリエイト
- AdInsight の課金実装は別リポジトリで管理されている可能性が高い

## Open Questions

- AdSense の掲載面と広告ユニット設計
- アフィリエイトの運用方針
- `app-ads.txt` の対象アプリと Web 本体の関係
- AdInsight の Play Billing 実装管理場所
