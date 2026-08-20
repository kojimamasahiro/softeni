# Monetization

## 概要

このリポジトリ内で確認できた収益化関連は、主に以下です。

- Google AdSense
- Google Analytics
- アフィリエイト導線

## Web 広告

### AdSense

- AdSense スクリプトは `src/pages/_app.tsx` で `next/script`（`strategy="lazyOnload"`）により全体読込
  （2026-07-05 まで `src/pages/_document.tsx` に直接 `<script async>` で配置していたが、下記の理由で移設）
- `public/ads.txt`
- `public/app-ads.txt`

#### ハイドレーション不一致（Minified React error #418）との競合（2026-07-05）

`/tournaments/local/` で本番のみ次の2つが連続して発生する事象を確認:

1. `Minified React error #418`（ハイドレーション不一致。React 側がツリーを再生成）
2. 直後に adsbygoogle 側 `Error: no_div`

原因: Auto ads の script を `_document.tsx` に素の `<script async>` として置いていたため、
キャッシュが温まっている等の条件でスクリプトの実行が React のハイドレーション完了より
早くなることがあり、Auto ads が DOM へ広告枠を挿入 → React のハイドレーション対象ツリーと
不一致 → React が該当ツリーを破棄・再生成 → Auto ads 側が挿入済みの div を見失い `no_div`、
という連鎖が起きていたと推定（ローカルでの完全な再現は取れていないため Assumption）。

対応: AdSense script を `_app.tsx` で `next/script` の `strategy="lazyOnload"` に変更し、
ハイドレーション完了後・アイドル時にのみ読み込むようにした。`_document.tsx` からは script
タグを削除済み。

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

#### モバイル全画面（ビネット）表示時のスクロール不能（2026-08-20）

症状: スマホでビネット（インタースティシャル）広告が表示されると、閉じた後も
ページがスクロールできなくなる。Google 側の Auto ads スクリプトが広告終了後に
`body`/`html` の `overflow` 等を正しく解除できないことがある既知の挙動と推定
（コード側に手動インタースティシャル実装は無く、本サイトの実装起因ではない）。

対応: コードでの回避（Auto ads の DOM に干渉する防御的 JS 等）はポリシー・保守性の
観点で見送り、**AdSense 管理画面でモバイル全画面（ビネット）を実際にオフに設定**した
（上記の推奨方針を実施に移したもの）。これにより上記の Open Questions のうち
「ビネット広告の費用対効果」は当面「オフで運用」として決着。

### アフィリエイト

- `src/components/AffiliateLink.tsx` に もしもアフィリエイト実装あり
- ただし `src/pages/_app.tsx` ではコメントアウトされており、現状は常時表示されていない

## 計測

- `src/pages/_app.tsx` で Google Analytics (GA4, Consent Mode v2) を読込
- Cookie 同意 UI は `src/components/CookieConsent.tsx`
- 同意前は `ad_storage` / `analytics_storage` を denied（cookieless ping は送信される＝advanced consent mode 相当）
- 同意後に granted へ更新
- 再訪ユーザーの同意は inline スクリプト内で `localStorage` を同期読みし、**初回 page_view より前**に復元する（hydration 後に復元すると初回PVが denied 計測になるため）
- `wait_for_update: 500` / `url_passthrough` / `ads_data_redaction` を設定し、同意確定待ち・クッキー不可時の計測ロスを軽減
- SPA 遷移は `gtag('config')` 再実行ではなく `gtag('event','page_view')` で送信（二重計上・セッション分断の回避）
- クッキーは `SameSite=Lax;Secure`（同一ドメイン first-party 用途のため Lax）

### 回遊計測のカスタムイベント（2026-08-15 追加）

回遊施策の合否を判定するために送っているイベント。手順・指標の定義は
[回遊検証ランブック](./circulation-verification.md)が正で、ここは実装の所在だけを書く。

| イベント | パラメータ | 送信箇所 | 用途 |
|---|---|---|---|
| `internal_link_click` | `module` / `from_type` / `to_type` | `lib/analytics.ts` の `attachInternalLinkTracking()`（`_app.tsx` から `<main>` に委譲リスナーを1つ張る） | 主指標「モジュールCTR」の分子 |
| `consent_accept` / `consent_decline` | なし | `_app.tsx` の `handleAccept` / `handleDecline` | 同意率（セッション系指標の解釈に必須） |

- **同意状態に関わらず送る**。未同意でも cookieless ping でイベントは GA4 に届くため、
  イベント数どうしの比（CTR）はセッション結合の成否に影響されない。これが主指標を
  「セッションあたりの表示回数」ではなくイベント比に置いている理由。
- **計測対象は `<main>` 内のリンクのみ**。サイドナビ（`aside[data-sidebar]`）とフッターは
  全ページ共通の定型リンクで、「そのページが次のクリックを作れたか」を測る対象ではない。
  この線引きはランブックの実測（ビルド済み `out/` の静的解析）と同じ定義にしてあり、
  静的解析のリンク本数と GA4 のクリック数を直接突き合わせられる。
- **モジュール分離は `data-link-module` 属性**。リンクを含む要素に付けるとその値が `module` に入り、
  付けなければ `unclassified` にまとまる。新しい回遊モジュールを作るときは属性を1つ足すだけでよく、
  リンクコンポーネント側には手を入れない。
- `from_type` / `to_type` のページ種別は `getPageType()`（`lib/analytics.ts`）が URL から判定する。
  判定はビルド済み `out/` の全4,243 URL に対して静的解析の分類と**一致0件差**を確認済み（2026-08-15）。
  回帰テストは `npm run analytics:test`。
- **GA4 側の設定が別途必要**: `module` / `from_type` / `to_type` をカスタムディメンション
  （イベントスコープ）に登録しないと探索で使えない。**登録前に届いたデータは遡って参照できない**。

### 計測精度に関する注意（2026-06）

- GA4 は client-side 計測のため、広告ブロッカー・Safari ITP・同意 denied により**実トラフィックより常に少なく出る**（一般に10〜40%）。これは実装では完全には解消できない。
- なお GA4 の `_ga` は **first-party クッキー**であり、ブラウザの「サードパーティクッキー許可」設定では精度は改善しない。
- 実数に近い基準値が必要な場合は、Cloudflare 配信を活かして **Cloudflare Web Analytics（cookieless・ブロックされにくい）** を併用し GA4 と突き合わせるのが有効（要 Open Question / 別途導入判断）。

## プライバシー・法務

- `src/pages/privacy.tsx` に広告・アクセス解析の説明あり
- ここには「Google AdSense などを利用予定」との文言がある

## score機能の新規収益化検討（2026-07-11〜）

score機能を一般ユーザーの練習試合でも使える形に広げる際の収益化案・需要調査・実データでの
パイロット分析は [score-general-availability.md](./score-general-availability.md) に分離して記載。
本ページ（AdSense/アフィリエイト）とは独立した検討トラック。

## 発展候補アイデア一覧（Idea Backlog）

- **Core Web Vitals改善**（2026-08-20、発散フェーズ）: AMP導入の代替案として出てきた
  アイデア。AMPは2021年以降SEO優位性がほぼ消滅・本サイトのUI（テーブル中心）とは相性が
  悪いため非推奨と判断し、代わりに既存ページのCore Web Vitals改善（画像最適化・不要JS
  削減など）でモバイル表示速度を上げる方が投資対効果が良いという結論。詳細は
  [raw/2026-08-20-idea-core-web-vitals-improvement.md](../raw/2026-08-20-idea-core-web-vitals-improvement.md)。

## Assumption

- Web 本体の主収益化は AdSense と一部アフィリエイト

## Open Questions

- AdSense の掲載面と広告ユニット設計
- アフィリエイトの運用方針
- `app-ads.txt` の対象アプリと Web 本体の関係
- 2026-07-05 の `#418`/`no_div` 対応（lazyOnload 化）後、本番で実際に解消したかのモニタリング（ローカルでは非決定的で再現できていない）

## 補足(2026-07-04)

- `adinsight-site/`(Android アプリ「AdInsight」紹介サイト。Google Play Billing 言及あり)は
  Softeni Pick 本体と無関係なため本リポジトリから削除した(docs/ui/decisions.md D-016)
