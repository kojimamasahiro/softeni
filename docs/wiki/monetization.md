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

#### 自動広告とサイドバー（AppShell）の競合（2026-06-23）

ADR-006 の2ペイン化（`AppShell`）でヘッダーが `sticky top-0` になった結果、
モバイルで AdSense 自動広告との競合が発生していた。

- 症状1: 上部アンカー広告（`position: fixed` で最上部）とヘッダーが最上部で
  重なり、左上のハンバーガーが押しにくい。
- 症状2: 自動挿入広告／アンカー予約枠が未配信のとき、ヘッダーとコンテンツの間に
  大きな空白だけが残る（本番の自動広告時のみ再現）。

コード側の対応:

- `globals.css` に `ins.adsbygoogle[data-ad-status='unfilled'] { display:none }` を
  追加し、未配信枠の空白を畳む。
- 補足: 2026-06-24 のレイアウト刷新でヘッダーは左固定サイドバー + 上部固定
  ヘッダー（モバイルでも sticky）構成に変更した。モバイルでヘッダーを sticky に
  保つため、上部アンカー広告との競合は下記の管理画面設定（アンカーを下部に）で
  回避する方針とする。

AdSense 管理画面側の推奨設定（コード変更不要、`docs/adsense-ui-proposal.md` §3 と整合）:

- ページ内フォーマット（自動挿入）をオフ。空白の主因。
- **アンカー広告は下部（bottom）に設定**。上部に出すと sticky ヘッダーと重なり、
  モバイルのハンバーガーが押しにくくなるため。
- モバイル全画面（ビネット）はオフ。
- `/beta/*` `/contact` `/privacy` `/about` を除外 URL に登録。

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
