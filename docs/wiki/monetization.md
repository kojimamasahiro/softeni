# Monetization

> **適用範囲: 汎用**。広告枠の置き方・CLS の決めごと・同意まわりは競技に依存しない。
> **2026-09-18 に現在の仕様だけへ圧縮した。** 不具合の調査経緯・実測分布・日付つきの追記は
> [raw/2026-09-18-wiki-archive-monetization.md](../raw/2026-09-18-wiki-archive-monetization.md)。

収益は **Google AdSense** が主。計測は Google Analytics（GA4）。
**アフィリエイトは現在使っていない**（`src/components/AffiliateLink.tsx`（もしもアフィリエイト）は
2026-07-04 に削除済み。再開するならコードから作り直す）。

score 機能側の収益化検討は [score-general-availability.md](./score-general-availability.md)（独立トラック）。

## AdSense の読み込み

- スクリプトは `src/pages/_app.tsx` で `next/script` の **`strategy="lazyOnload"`** で読む。
  `_document.tsx` に素の `<script async>` で置くと、ハイドレーション完了より先に Auto ads が
  DOM を触り、`Minified React error #418` → `no_div` の連鎖が起きる（2026-07-05 に実際に発生）。
  **この読み込み方を変えないこと。**
- `public/ads.txt` / `public/app-ads.txt`

### 管理画面側の設定（コード変更では戻せない）

- **ページ内フォーマット（自動挿入）はオフ**。位置を選べず高さも確保されず、未配信時に空白が残るため。
- **アンカー広告は下部（bottom）**。上部は sticky ヘッダーと重なり、モバイルのハンバーガーが押しにくくなる。
- **モバイル全画面（ビネット）はオフ**。閉じた後にページがスクロールできなくなる事象があり、
  コード側での回避はポリシー・保守性の観点で採らない。
- 除外 URL: `/beta/*` `/contact` `/privacy` `/about`
- `globals.css` の `ins.adsbygoogle[data-ad-status='unfilled'] { display:none }` は未配信枠の空白を畳むためのもの。

## 手動広告枠（AdUnit）

自動広告のページ内挿入をやめると売上が落ち、戻すとレイアウトが崩れる。そこで**位置と高さを自分で決める枠**を実装した。
判断は [ADR-016](../adr/ADR-016-manual-adsense-units-over-auto-ads.md)、原案は [adsense-ui-proposal.md](../raw/2026-06-12-adsense-ui-proposal.md)。

| 何 | どこ |
|---|---|
| 枠コンポーネント | `src/components/AdUnit.tsx` |
| スロットIDの一元管理 | `lib/ads.ts` の `AD_SLOTS`（**空文字なら DOM ごと出さない**＝コードを入れたまま配信だけ止められる） |
| フッター枠の出し分け | `lib/ads.ts` の `FOOTER_AD_PAGE_TYPES` / `FOOTER_AD_MIN_CONTENT_CHARS` |
| ページ種別の判定 | `getPageType()`（`lib/analytics.ts`・回帰テスト `npm run analytics:test`） |

### ファーストビュー枠（5面）

`/players/` は検索ボックスの直後、大会結果は リード文の直後（年度/カテゴリ切り替えの**前**）、
`/news/<id>/` はリード文の直後、`/tournaments/` は「これから開催」の直後（フィルターバーの前）、
`/players/<id>/results/` はヘッダーの直後。

- 枠高は280pxで、375×812 の実測で**枠全体がファーストビュー内に収まる**位置に置いてある。
  **配置を変えたら枠上端を測り直すこと**（節の順序を1つ変えるだけで簡単に破れる。目視で判断しない）。
- 選手結果ページだけ枠が低い位置にあるのは、ヘッダーの主要大会タイル（`PlayerMajorResults`）を優先したため。

### フッター直上の枠（`AppShell` に1箇所）

`<main>` と `{footer}` の間に1箇所だけ置き、`FOOTER_AD_PAGE_TYPES` で出し分ける。
**面を増やすときはこのリストに1行足すだけ**で、ページを1枚ずつ編集しない。
除外は `beta` と `other`（`/contact` `/privacy` `/about` `/faq` `/404` `/growth/*` が `other` に入る。
巻き添えで `/tournaments/major|local|block/` の3枚も外れる）。
**全ページ共通で1ユニット**なので、フッター枠の収益はページ種別に分解できない。

**中身の無いページには出さない**: `AppShell` がマウント後に `main.textContent`（空白除去）を測り、
**`FOOTER_AD_MIN_CONTENT_CHARS`（400文字）未満なら枠を出さない**。AdSense はコンテンツのないページへの
掲載を禁じており、種別の許可リストだけでは大会が未登録の `/tournaments/local/<県>/`（本文78文字）のような
違反面を作ってしまうため。400 なら成績表が1つでも載っていれば残り、**データが増えれば自動的に広告が出る**
（除外リストの保守が要らない）。副作用としてフッター枠だけは SSR に含まれずマウント後に現れるが、
ページ最下部なので CLS にはならない。

### 配置の原則

- **ファーストビュー内に置く**。ただし置くのは**そのページの主目的の操作・リード文を終えた直後**で、
  h1 の上や主目的の操作より上には置かない。
- **本文・読み物を分断しない**。表・カード・トーナメント表の内部には入れない。
- **1ビューポート内に2枠を同時に出さない**。ファーストビュー枠とフッター枠が両方出る面でも、
  最短のページで間隔1,078px > 812px であることを実測で確認している。薄い種別
  （高校学校ページ・中学チーム・チーム年度）はフッター枠だけにしてある。
- **薄いページには置かない**（管理画面の除外 URL と同じ。news 記事は `categories.length === 0` なら出さない）。
- 密度の外部基準は Lighthouse Publisher Ads Audit の**ビューポート垂直方向30%**。
  280/812 = 34% で**モバイルでは超えている**。1ページ1枠を守る前提で許容しており、**2枠目を足すときに効いてくる**。

### CLS を出さないための決めごと

1. **`ins` はマウント後にだけ描画する**（サーバー出力に置くと #418 → `no_div` の連鎖を招く）。
   高さを持つラッパーはサーバー出力に含めるので位置はずれない。
2. **`ins` に `router.asPath` の key を付ける**。SPA 遷移でノードを使い回すと2ページ目以降で広告が出ない。
3. **`data-full-width-responsive="false"`**。`true` だとモバイルで端末幅いっぱいに広がり、
   本文カラムの外へはみ出して `min-height` も超える。

未配信のときは枠ごと畳む（本文の途中に空白が残り続ける方が実害が大きいという判断）。

### 段階導入の判定と、切り分け方

| 指標 | 見る場所 | 撤退ライン |
|---|---|---|
| CLS | PageSpeed Insights / CrUX（該当種別の代表URL） | 導入前より悪化し 0.1 超 |
| ページRPM・推定収益 | AdSense レポート（ユニット単位） | 導入2週後の推定収益が導入前2週を下回る |
| 回遊 | GA4 `internal_link_click` ÷ `page_view`（該当 `from_type`） | 相対20%以上の低下 |

閾値は自サイトの実測ではなく**暫定（Assumption）**。1面目の実測が出たら差し替える。
測定手順は [回遊検証ランブック](./circulation-verification.md) の手順2・3。

**4面ぶんのスロットIDを同時に入れたため、悪化したときにどの面が原因かは切り分けられない。**
面別 RPM の比較は成立する（ユニットを面ごとに分けてあるため）。悪化したら `AD_SLOTS` の該当キーを
空文字に戻して1面ずつ消し込む。**2枠目を足すときは1面ずつに戻すこと**。

### 回遊検証との両立

選手結果ページと高校学校ページ（合わせて全ページの62%）は回遊検証の対照群・施策群にあたるが、
**広告を入れてよい**。ランブックの要件は「対照群に広告を入れないこと」ではなく
**測定期間中に両者が別々に変化しないこと**で、判定式が（学校ページの変化）−（選手結果ページの変化）だから。

> **測定期間中は、この2種別の広告設定を触らないこと。** 片側だけ動かした瞬間に判定式が壊れる。

### 残タスク

1. **下部アンカー広告とフッター枠の重なりを本番で確認する**（モバイルで「フッター枠280px + アンカー約50px」が
   同一画面に並ぶ＝812pxの41%）。ローカルでは自動広告が配信されないため確認できない。
   見苦しければアンカーを切るかフッター枠を切るかを決める。
2. 各面の代表URLで CLS を確認（PageSpeed Insights）。
3. 上表の閾値で判定する。撤退する場合は該当キーを空文字に戻す。

## 計測（GA4）

- `src/pages/_app.tsx` で GA4（Consent Mode v2）を読み込む。
- **開発環境では GA4 を読み込まない**。`isDevelopment()`（`lib/env.ts`）で `GA_ID` を `undefined` にしており、
  `gtag.js` も inline も `dataLayer` も出ない。dev の閲覧が本番プロパティに混ざるのを防ぐため。
  確認したいときだけ `.env.local` に `NEXT_PUBLIC_GA_IN_DEV=true`。
  **Cloudflare Pages のプレビューは本番ビルドなのでこの gate では止まらない（未対応）。**
- SPA 遷移は `gtag('config')` の再実行ではなく `gtag('event','page_view')`（二重計上・セッション分断の回避）。
- クッキーは `SameSite=Lax;Secure`。
- `wait_for_update: 500` / `url_passthrough` / `ads_data_redaction` で同意確定待ち・クッキー不可時の計測ロスを軽減。

### 同意の扱いは地域で分かれる（[ADR-018](../adr/ADR-018-consent-by-region.md)）

- **日本（端末TZが `Asia/Tokyo`）: バナーを出さず** `ad_storage` / `analytics_storage` とも granted。
  外部送信は `src/pages/privacy.tsx`「4. 外部送信について」で公表している（電気通信事業法の外部送信規律）。
  **この公表とバナー非表示はセットで、片方だけ変えてはならない。**
- **それ以外（EEA/UK/スイスを含む）**: バナーを出し、同意前は denied（cookieless ping は送信される）、同意後に granted。
- 過去に「拒否する」を押した人（`localStorage.cookieConsent === 'false'`）は**地域に関わらず** denied のまま。
- 地域判定は `lib/consentRegion.ts` の `isConsentExemptRegion()`。タイムゾーンを使う理由と限界
  （外れたときは必ず「バナーを出す」側に倒れる）は同ファイルのコメントが正。
- 同意状態は inline スクリプトで `localStorage` とタイムゾーンを同期読みし、**初回 page_view より前**に確定させる。
- UI は `src/components/CookieConsent.tsx`。

### 回遊計測のカスタムイベント

手順・指標の定義は [回遊検証ランブック](./circulation-verification.md) が正。ここは実装の所在だけ。

| イベント | パラメータ | 送信箇所 |
|---|---|---|
| `internal_link_click` | `module` / `from_type` / `to_type` | `lib/analytics.ts` の `attachInternalLinkTracking()`（`<main>` に委譲リスナー1つ） |
| `consent_accept` / `consent_decline` | なし | `_app.tsx` の `handleAccept` / `handleDecline` |

- **同意状態に関わらず送る**。未同意でも cookieless ping で届くので、イベント比（CTR）はセッション結合の成否に影響されない。
  主指標を「セッションあたり」ではなくイベント比に置いているのはこのため。
- **計測対象は `<main>` 内のリンクだけ**。サイドナビとフッターは全ページ共通の定型リンクで、
  「そのページが次のクリックを作れたか」の対象ではない。ランブックの静的解析と同じ定義にしてあり、突き合わせられる。
- **モジュールの分離は `data-link-module` 属性**。付けなければ `unclassified`。新しい回遊モジュールは属性を1つ足すだけ。
- **GA4 側でカスタムディメンション（イベントスコープ）の登録が必要**。`module` / `from_type` / `to_type` を
  登録しないと探索で使えず、**登録前に届いたデータは遡って参照できない**。
- **2026-09-09 以降、`consent_accept` / `consent_decline` は日本では発生しない**（バナーを出さないため）。
  以後の同意率は「非免除地域でバナーを操作した人の中での比率」で、**変更前の数値と地続きではない**。

### 計測精度

- GA4 は client-side 計測なので、広告ブロッカーと Safari ITP により**実トラフィックより常に少なく出る**
  （一般に10〜40%）。実装では解消できない。同意 denied 分は日本では地域別同意でほぼ消えた。
- `_ga` は **first-party クッキー**。ブラウザの「サードパーティクッキー許可」設定では精度は改善しない。
- 実数に近い基準値が要るなら Cloudflare Web Analytics（cookieless）の併用が候補（未導入）。

## プライバシー・法務

- `src/pages/privacy.tsx` に広告・アクセス解析の説明。「4. 外部送信について」は `EXTERNAL_TRANSMISSIONS` の表で
  送信先・利用目的・送信情報を掲載している（GA4・AdSense・YouTube 埋め込みプレーヤー）。**送信先サービスを増減させたらこの表の更新が必須。**
  YouTube は試合詳細の動画のために足した（YouTube API のデベロッパー ポリシーも開示を求める。[beta-matches-results.md](./beta-matches-results.md)「埋め込む動画の出どころ」）。
- 「5. Cookie の利用と停止方法」に地域ごとの扱いとオプトアウト手段。
- **未対応**: AdSense を配信しているため、EEA/UK には Google 認定 CMP が必要で、自作バナーは本来これを満たさない
  （[open-questions.md](./open-questions.md)）。

## 発展候補アイデア一覧（Idea Backlog）

| アイデア | 状況 | raw |
|---|---|---|
| AdSense 手動広告枠 | **実装済み・全面展開**（2026-08-25）。残は上記「残タスク」 | [2026-08-22](../raw/2026-08-22-idea-adsense-manual-ad-units.md) / [2026-08-23](../raw/2026-08-23-adsense-manual-ad-units-implementation.md) |
| Core Web Vitals 改善 | 発散フェーズ（2026-08-20）。AMP は SEO 優位性が消えテーブル中心の UI とも合わないため非推奨、代わりに既存ページの CWV を上げる | [2026-08-20](../raw/2026-08-20-idea-core-web-vitals-improvement.md) |
| 同じ仕組みを他競技へ広げる | 発散フェーズ（2026-09-18）。ピックルボール・バドミントン・ソフトボールは調査のうえ見送り。次は (1) 名前クエリの空白 (2) 一次情報がPDFだけか (3) 専門メディアの薄さ、の3条件で選ぶ | [2026-09-18](../raw/2026-09-18-idea-multi-sport-expansion.md) |

## Open Questions

- 手動枠の合否閾値が暫定値であること（CLS 0.1 / 推定収益 / 回遊20%）。1面目の実測でベースラインに差し替える。
- アフィリエイトを再開するかどうか（コードは削除済み）。
- `app-ads.txt` の対象アプリと Web 本体の関係。
- lazyOnload 化のあと `#418` / `no_div` が本番で解消したかのモニタリング（ローカルでは再現できない）。

## Assumption

- Web 本体の主収益化は AdSense。
