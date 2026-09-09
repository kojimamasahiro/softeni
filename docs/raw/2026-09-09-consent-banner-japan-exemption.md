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

## Compile Log

docs/wiki への反映と、意図的に落としたもの。

**反映した**

- 法的整理・地域方針・判定手段の採用理由 → `docs/adr/ADR-018-consent-by-region.md`（新規）
- 実装の所在と挙動 → `docs/wiki/monetization.md`「計測」節
- 同意率の分母が変わること・ベースラインを取る順序 → `docs/wiki/circulation-verification.md`
- セッション系指標が日本では読めるようになったこと → `docs/wiki/public-pages.md`
- 認定 CMP の積み残し → `docs/wiki/open-questions.md`

**落とした**

- 検証ケースの表 → wiki は現状仕様を書く場所で、一度きりの手元確認の記録は raw に残せば足りる。
- `navigator.language` 案の棄却理由 → ADR の Alternatives に1行だけ残し、詳細は raw に置く。
  wiki 側で繰り返す価値がない。
- Cloudflare Pages Functions 案のキャッシュ・コストの議論 → 採用しなかった案の詳細で、
  現状仕様の理解には要らない。ADR の Alternatives から本ノートを参照する形にした。
- サイト内オプトアウト UI の案 → まだ着手判断をしていないので Open Questions にも上げず、
  raw の積み残しに留める。
