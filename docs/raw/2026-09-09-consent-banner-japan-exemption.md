# 日本からのアクセスを Cookie 同意バナーの対象外にする（2026-09-09）

## 出発点

「GA4 のために同意ポップアップを出しているが、日本はそこまでしなくていいと聞いた。
同意してくれないユーザーがいて実際の測定ができていない。日本が多いので、日本のユーザーは
同意なしで GA4 を計測できるようにしたい」。

実装前の状態:

- `src/pages/_app.tsx` が Consent Mode v2 を実装。`consent default` は `ad_storage` /
  `analytics_storage` とも denied。
- `src/components/CookieConsent.tsx` が全ユーザーにバナーを表示し、「同意する」で granted。
- 未同意でも cookieless ping でイベント自体は届くが、`client_id` が安定しないため
  セッション系の指標（セッションあたりの表示回数、直帰、回遊の連鎖）が読めない。
  この制約は [回遊検証ランブック](../wiki/circulation-verification.md) と
  [public-pages.md](../wiki/public-pages.md) の「ユーザーの課題を体系的に見つける」節に
  繰り返し出てくる。

## 法的な整理（この判断の前提）

日本:

- **個人情報保護法**: Cookie 等の端末識別子は「個人関連情報」であり、それ自体は個人情報ではない。
  自社サイトの分析目的で GA4 を使う限り、本人のオプトイン同意は要件になっていない。
- **電気通信事業法の外部送信規律**（2023-06-16 施行、第27条の12）: 利用者の端末から
  外部事業者へ送信される情報について、**「同意 / オプトアウトの機会提供 / 通知・公表」の
  いずれか**で足りる。オプトイン同意は必須ではない。当サイトのような不特定利用者向けの
  オンライン情報提供は対象事業者に該当しうるため、**公表**で要件を満たす方針を採る。

EEA / 英国 / スイス:

- GDPR + ePrivacy 指令により、解析・広告 Cookie は**事前同意が必須**。ここは変えない。

## 決めたこと

1. **免除範囲は日本のみ**。米国・その他アジア等も理屈の上では同意不要だが、ブラジル LGPD・
   韓国など地域ごとの検討が要るので広げない。判定を外したときの影響範囲も小さく保つ。
2. **日本では `ad_storage` / `analytics_storage` の両方を granted** にする。日本では広告
   Cookie もオプトイン同意の対象ではなく、AdSense のパーソナライズド広告を止める理由がない。
   収益（本サイトの主収益は AdSense）を落とさないほうを採る。
3. **過去に「拒否する」を押した人の選択は地域に関わらず優先する**。免除地域でも
   `localStorage.cookieConsent === 'false'` なら denied のまま。

## 地域判定の手段（検討と採用理由）

| 案 | 内容 | 判定 |
|---|---|---|
| Cloudflare の国判定（`/cdn-cgi/trace` を fetch） | `loc=JP` が取れる。正確 | **不採用**。非同期なので初回 `page_view` より前に同意状態を確定できない。「同意済みなのに初回PVだけ denied 計測」という、以前わざわざ inline スクリプトで潰した問題が再発する |
| Cloudflare Pages Functions の `_middleware` で国別に出し分け | サーバ側で確定できる | **不採用**。`next.config.mjs` は静的書き出し（`out/`）で、全 HTML を Worker 経由にするとキャッシュ・コストの前提が変わる。得られる精度に対して代償が大きい |
| 端末のタイムゾーン（`Intl.DateTimeFormat().resolvedOptions().timeZone`） | `Asia/Tokyo` なら免除 | **採用**。inline スクリプト内で**同期的に**読めるので初回 page_view より前に確定できる |
| `navigator.language === 'ja'` | 日本語設定なら免除 | **不採用**。EEA 在住の日本語話者を免除してしまう。GDPR は所在地で決まるので、言語は判定軸として誤っている |

タイムゾーン判定の精度は落ちるが、**外れ方が安全側に倒れる**のが決め手:

- 日本在住だが端末が `Asia/Tokyo` でない → バナーが出る（＝従来どおり）。損失は計測だけ。
- EEA 在住で端末が `Asia/Tokyo` → 実質起こらない。

## 実装

- `lib/consentRegion.ts`（新規）: `CONSENT_EXEMPT_TIME_ZONE` と `isConsentExemptRegion()`。
  判定の根拠と限界はここのコメントが正。
- `src/pages/_app.tsx`: gtag 初期化 inline スクリプトの「同意復元」ブロックを書き換え。
  `storedConsent !== 'false' && (consentExempt || storedConsent === 'true')` で granted。
  inline スクリプトはハイドレーション前に走る必要があるため判定式は素の JS で書き下し、
  タイムゾーン定数だけをモジュールから補間して共有している。
- `src/components/CookieConsent.tsx`: 免除地域では `useEffect` の先頭で return し、
  バナーを出さない。
- `src/pages/privacy.tsx`: 「4. 外部送信について」（外部送信規律に基づく公表・送信先の表）と
  「5. Cookie の利用と停止方法」（地域ごとの扱い・オプトアウト手段）を追加。
  **この公表があって初めてバナー廃止が成り立つ**ので、片方だけ変えてはいけない。

## 検証（2026-09-09、`next dev`）

| ケース | バナー | consent |
|---|---|---|
| `Asia/Tokyo` / 未保存 | 出ない | `default: denied` → `update: granted`（`config` より前） |
| 非免除TZ（定数を一時的に `Europe/Berlin` にして再現）/ 未保存 | 出る | `default: denied` のみ（`update` なし） |
| `Asia/Tokyo` / 過去に拒否（`'false'`） | 出ない | `default: denied` のみ（拒否を尊重） |

`isConsentExemptRegion()` 単体は Node の `TZ` を差し替えて確認:
`Asia/Tokyo → true`、`Europe/Berlin` / `Europe/London` / `America/New_York` / `UTC → false`。

## 積み残し

- **EEA/UK に対する Google 認定 CMP**: AdSense を配信している以上、Google の EU ユーザーの
  同意ポリシー上、EEA/UK には認定 CMP が必要で、自作バナーは本来これを満たさない。
  今回の変更で新たに生じた問題ではない（従来から未対応）が、地域を分けたことで
  「バナーが残るのは EEA/UK/スイスだけ」と範囲がはっきりしたので、対応するなら今が区切り。
- **同意率の分母が変わる**: `consent_accept` / `consent_decline` は日本では発生しなくなるため、
  以後の同意率は「非免除地域で、かつバナーを操作した人の中での比率」になる。
  回遊検証のベースライン（2026年9月末）は、この変更の**後**に取ること。前後で混ぜない。
- サイト内オプトアウト UI（`/privacy` に「計測を停止する」トグルを置く）は未実装。
  外部送信規律は公表で足りるため必須ではないが、あると姿勢としては強い。
- タイムゾーン判定を後から Cloudflare の国判定で補強する案（同期判定で暫定決定 → 非同期で
  訂正）は、複雑さに見合わないと判断して見送り。必要になったら再検討。

## 追記（同日）: dev から計測を送らないようにする

バナー廃止の直後に「dev は送られないようにしたい」。日本が同意なしで granted になったことで、
**開発機がまさにその条件に当たる**ため、以前より本番プロパティに混ざりやすくなっていた。

`src/pages/_app.tsx` で `isDevelopment()`（`lib/env.ts`・既存ヘルパー）を使い、開発環境では
`GA_ID` を `undefined` にした。`{GA_ID && ...}` の既存構造にそのまま乗るので、`gtag.js` の
読み込みも inline スクリプトも `page_view` / `internal_link_click` の送信もまとめて止まる。

同意まわりを dev で確認する手段は残す必要がある（今日の検証がまさにそれだった）ので、
`NEXT_PUBLIC_GA_IN_DEV=true` を `.env.local` に置いたときだけ有効化できる逃げ道を付けた。
`.env.example` に注記済み。

検証（`next dev`）:

- 既定: `gtag-init` 無し / `googletagmanager` の script 無し / `window.dataLayer` 無し /
  `window.gtag` undefined / googletagmanager・google-analytics へのネットワークリクエスト 0件
- `NEXT_PUBLIC_GA_IN_DEV=true`: `gtag.js` と inline スクリプトが復活し、
  `consent default: denied` → `update: granted` まで通る（確認後 `.env.local` は元に戻した）

### この追記の積み残し

- **Cloudflare Pages のプレビューデプロイ**は本番ビルド（`NODE_ENV=production`）で
  `wrangler.toml` の `[vars]` から `NEXT_PUBLIC_GA_ID` が入るため、**この gate では止まらない**。
  プレビューを使っているなら、inline スクリプト側で `location.hostname` を見る等の対処が要る。
  プレビューデプロイを実際に使っているかどうかを確認していないので、対処は入れていない。
- **AdSense スクリプトは dev でも読み込まれたまま**（`adsbygoogle.js` の `<script>` は DOM にある）。
  localhost からの読み込みは無効なトラフィックと見なされうる一方、止めると広告枠の
  レイアウト確認（[ADR-016](../adr/ADR-016-manual-adsense-units-over-auto-ads.md) の主題）が
  dev でできなくなる。トレードオフがあるので今回は触っていない。

---

## 追記2（同日）: Idea Backlog 側の該当項目を修正

GA4 のログを前提にしていたアイデアを洗い、影響のあるものだけ更新した。

**更新した**

- `docs/raw/2026-09-06-idea-user-problem-discovery.md` — 追記2。信号の棚卸しで「×」だった
  セッション単位の指標が日本については読めるようになったこと、および
  **溜まっている 2026-08-09〜09-09 のクエリには自分の dev ブラウジングが混ざっているので
  `hostname` で `localhost` を除外して読むこと**。後者はこのアイデアの手順1（検索クエリを
  頻度順に読む）を直撃するので、実行前に知っている必要がある。
- `docs/raw/2026-08-15-idea-highschool-school-page-cross-links.md` — 追記。主指標
  （モジュールCTR）の設計は変えないこと、副指標の信頼度が上がる一方で前提指標だった
  同意率が事実上使えなくなること、**ベースラインは 2026-09-09 より後の期間から取ること**。
- エリアページ（`public-pages.md` / `highschool.md`）の該当行と、
  `idea-backlog.md` の索引サマリを同期。

**更新しなかった**

- `docs/raw/2026-09-06-idea-live-streams.md` — GA4 への言及はあるが「PV・RPM の絶対値は
  管理画面にしかない」という文脈だけで、同意状態にも dev 混入にも依存しない。

## Compile Log

docs/wiki への反映と、意図的に落としたもの。

**反映した**

- 法的整理・地域方針・判定手段の採用理由 → `docs/adr/ADR-018-consent-by-region.md`（新規）
- 実装の所在と挙動 → `docs/wiki/monetization.md`「計測」節
- 同意率の分母が変わること・ベースラインを取る順序 → `docs/wiki/circulation-verification.md`
- セッション系指標が日本では読めるようになったこと → `docs/wiki/public-pages.md`
- 認定 CMP の積み残し → `docs/wiki/open-questions.md`
- dev で GA4 を読み込まないこと・逃げ道の env 変数・プレビューデプロイが対象外であること
  → `docs/wiki/monetization.md`「計測」節
- Idea Backlog 側で前提が変わる2件（ユーザーの課題発見 / 学校ページの回遊強化）
  → 各 raw に追記し、`public-pages.md` / `highschool.md` の行と `idea-backlog.md` の索引を同期。
  詳細は上の「追記2」。

**落とした**

- 検証ケースの表 → wiki は現状仕様を書く場所で、一度きりの手元確認の記録は raw に残せば足りる。
- `navigator.language` 案の棄却理由 → ADR の Alternatives に1行だけ残し、詳細は raw に置く。
  wiki 側で繰り返す価値がない。
- Cloudflare Pages Functions 案のキャッシュ・コストの議論 → 採用しなかった案の詳細で、
  現状仕様の理解には要らない。ADR の Alternatives から本ノートを参照する形にした。
- サイト内オプトアウト UI の案 → まだ着手判断をしていないので Open Questions にも上げず、
  raw の積み残しに留める。
- dev の検証ログ（各ケースで何が無かったか）→ 一度きりの手元確認なので raw に留める。
- AdSense を dev で止めるかのトレードオフ → 判断していないので wiki には書かない。
  決めたら `monetization.md` か ADR-016 側の話になる。
