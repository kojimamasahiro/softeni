# 開催前の大会・国際大会の露出 実行ランブック

> **適用範囲: 混在**。「新規URLを作らず既存ページで受ける」「開催前の大会を出す」の考え方は汎用。
> アジア競技大会2026の運用はソフトテニス固有。
> **2026-09-18 に現在の仕様と残作業だけへ圧縮した。** 完了項目の実施内容・実測値・検算は
> [raw/2026-09-18-wiki-archive-upcoming-tournaments-runbook.md](../raw/2026-09-18-wiki-archive-upcoming-tournaments-runbook.md)。

## これは何か

「開催前の大会を出す」（[public-pages.md](./public-pages.md)）の**残作業を順番つきで実行するための一覧**。
出発点は「アジア大会が選手にとって大舞台なのにファンに伝わっていない」という外部の声で、
第1弾で作ったのは pull（探しに来た人が見つけられる）まで。元の問題は awareness なので push を足していく。
背景と実測は [raw/2026-07-26](../raw/2026-07-26-idea-tournament-metadata-platform.md) 追記6〜9。

**新規 URL は作らない。** 既存ページの更新で取る（[seo.md](./seo.md) #11 と同じ考え方）。
検索需要のピークは会期直前〜会期中なので、会期の1週間前までに出ていないと間に合わない。

## いま動いているもの: アジア競技大会2026（9/18〜23・名古屋）

### S11 会期中の結果取り込み（全種目・全組）

**取り込む範囲**: **5種目すべて全組・全試合**（2026-09-18 団体 → 2026-09-19 混合 → 同日 男女シングルス、
と段階的にユーザーが判断した結果。当初の方式A＝日本が出た試合だけは**もう使っていない**）。

| 種目 | 予選リーグ | 出場 |
|---|---|---|
| 男子団体 | A〜C | 11か国 |
| 女子団体 | A〜B | 8か国 |
| 混合ダブルス | A〜F | 19組 |
| 男子シングルス | A〜G | 22人 |
| 女子シングルス | A〜H | 23人 |

全組を持つ理由は**決勝トーナメントの席が (組, 組内順位) で決まる**（`knockoutDraw`。ADR-015）ため。
日本の組だけを持つと他の組から上がってきた席を実体に解決できず、`check:entries` が
`knockout-draw-unresolved` を出してブラケットも描けない。

- 団体戦はエントリーが**国**なので `participants` に選手が増えない。
- **個人種目は外国選手が `participants` に増える**（＝実質的に方式B）。ランキングは除外済みで、
  結果が入るまでは選手の通算成績にも入らない（prebuild の `data/players/**` 差分は0で確認）。
  **結果が入れば外国選手も勝敗を持つ**ので、会期後に選手ページ側の扱いを見直す。
- **転記の取りこぼしは `draw.json` の `expected`（種目ごとの組と出場数）で止める**。
  組を1つ落とすとスクリプトが「組が合わない／エントリー数が合わない」で止まる。

**表記**:

- **日本選手は国内大会と同じ id**（例: `上松_俊貴_NTT西日本_広島県`）。既存の選手ページに直接つながる。
  対応表は `tools/asian-games-2026/build_details.py` の `JAPANESE_PLAYERS`
- **外国選手**は公式のローマ字（姓は大文字のまま）、`team` に**国名（日本語）**、`prefecture: null`
  （例: `DOEUM_Samsocheaphearun_カンボジア`）。コリアカップのような国コードは使わない
- **団体戦のチーム名は国名（日本語）**。チームマスタにも国名のチームとして載る
- **ランキングから除外**: `data/ranking-config.json` の `excludeTournaments` に `asian-games` を追加済み
  （[ranking.md](./ranking.md)「国際大会の除外」と同じ理由）

**手順**: 公式リザルトサイト（results.asiangames2026.org。PDF ではなく SPA）→
`tools/asian-games-2026/draw.json` に転記 → `python3 tools/asian-games-2026/build_details.py`
→ `npx prettier --write` → `data/tournaments/details/asian-games/2026/*.json`。
**`draw.json` を日ごとに書き足して作り直す**（冪等）。行は1試合1オブジェクトで、
組み合わせ・結果（`score`）・個人種目のゲームごとのポイント（`games`。公式 API の `ResDetail`）・
オーダー（`rubbers`）・決勝Tの繋がり（`id` / `next`）・
席順（`knockoutDraw`）を1ファイルに持つ。読み取り方の注意は [data-import.md](./data-import.md)。

スクリプトは「組が総当たりとして完全か」「個人種目の各組に日本がいるか」「オーダーの勝ち数＝本数」
「決勝Tの席が予選リーグの順位に解決できるか」を検査して、食い違えば止まる。
**組内順位が勝ち数・本数で並びきらないときも止まる**（公式の順位規則を推測しないため）。
決着していない試合の成績は `rank.kind: ongoing`（ADR-007）、予選リーグで敗退したチームは
`tournament: null` ＋ `roundrobin.{group, rank}`。

**団体戦1試合の形**: `M1 = ダブルス / M2 = シングルス / M3 = ダブルス`（ADR-020 の `D1` / `S` / `D2`）。
予選リーグは決着後も3対戦すべて行い、決勝Tは2勝で打ち切って第3対戦が `Cancelled`（＝`not_played`）。
途中棄権（公式表示 `RET` / `W`）は `retired`（`draw.json` では rubber の5番目に棄権した側を書く）、
不戦勝（片側がペアを出さない。公式表示 `BYE`）は `walkover`（出さなかった側のペアを空配列にする）。

**注意**: `details/` の中身が変わると高校データパイプラインの鮮度チェック（prebuild）が落ちる。
`npm run highschool:pipeline` を流して解消する（コリアカップと同じ）。worktree では本体の
`.venv/bin` を PATH に通す（`pykakasi` が要る）。

**前回大会（第19回・杭州。2023年10月開催なので `year: 2023`）も同じ形で持つ**。出典は ASTF が公開している
大会公式の結果PDF（5種目）で、`tools/asian-games-2023/draw.json` → `python3 tools/asian-games-2023/build_details.py`。
組み立ては 2026 のスクリプトを読み込み、日本選手の対応表（2023年度の国内大会の表記）だけ差し替える。
**組内順位は公式の順位表（`standings`）を正とし、転記した試合から勝ち数・本数を数え直して一致しなければ止まる**
（PDFの予選リーグは本数しか無く、3人が1勝1敗で並んだ組は得点まで見ないと並ばないため）。
予選リーグの不戦勝は `retired: true`＋勝者の本数を満点、途中棄権は `retired: true`＋公式の本数。
名前の揃え方と判断の経緯は [raw/2026-09-23-asian-games-2023-results.md](../raw/2026-09-23-asian-games-2023-results.md)。

一日目の取り込みで踏んだ罠・成績の付け方の実例は
[raw/2026-09-18-asian-games-day1-results.md](../raw/2026-09-18-asian-games-day1-results.md)。

**競技方式**（2026-09-19 追加。[ADR-021](../adr/ADR-021-category-competition-format.md)）:
公式リザルトサイトは方式を文章で公開しておらず、Schedule / Groups / Brackets の3画面を
突き合わせないと形式が分からない。混合・男女シングルスの3種目に `categories[].format` を入れた。

| 種目 | 方式 | 推定の有無 |
|---|---|---|
| 混合ダブルス | 19組・6組（A〜F。A組は実質2組）→ 各組上位2組の12組が決勝T（1回戦8枠のうち4枠が不戦勝） | なし（9/21 の組み合わせで推定が当たったので `assumptions` を外した） |
| 男子シングルス | 22人・7組（A〜G。D組は実質2人）→ 各組1位が準々決勝（8枠のうち1枠が不戦勝。A組の1位） | なし（9/22 の組み合わせで確定） |
| 女子シングルス | 23人・8組（A〜H。G組は実質2人）→ 各組1位が準々決勝（不戦勝なし） | なし（同上） |

3種目とも**3位決定戦は無い**（準決勝に `Medal` が付く。団体戦と同じ）。
**どの組が不戦勝になるかは事前に公表されない**ので、決勝Tの席（`knockoutDraw`）は
公式の1回戦の組み合わせ（Brackets）が出てから入れる（推測で席を作らない）。
混合では A・C・D・F組の1位、男子シングルスでは A組の1位が不戦勝だった（理由は公表されていない）。
不戦勝の席の選手は次の対戦カードが決まるまで試合を持たないので、`build_details.py` が
`knockoutDraw` の不戦勝の席から「ベスト4進出」などの進行中の成績を付ける（無いと予選敗退扱いになる）。

**選手名の罠**: メダルマッチ（準決勝・決勝）の結果ページは、狭い画面だと選手名が `LEE H` のような
**頭文字表記**になる（`.show-mobile`）。韓国男子に LEE Hyungwon と LEE Haneul がいるので、
頭文字では決められない。**表示幅を広げて（`.hide-mobile` 側の）フルネームで読む**。

**状態**（2026-09-23 大会終了）: **5種目すべて決勝まで入った**（団体はオーダーも）。
混合と男女シングルスは**全試合にゲームごとのポイント**がある。進行中（`rank.kind: ongoing`）の成績は残っていない。
会期後の課題（外国選手が勝敗を持つことの扱い）は [open-questions.md](./open-questions.md)。

### 種目別の日程（S10・実装済み）

会期だけでは「いつ見ればいいか」が分からないため、種目ごとの日程（決勝の開始時刻まで）を出している。

- データ: `information/asian-games.json` の `categories[].schedule` ＋ `scheduleSource` /
  `scheduleSourceUrl` / `scheduleCheckedOn`（形は [data-model.md](./data-model.md)）。`categories` の並びも日程順
- 表示: 大会ハブの開催前ブロックに「種目別の日程（予定）」表（`SportsEvent.subEvent` に日付）と、
  代表選手の選手ページ（出場種目だけ）。整形は `lib/categorySchedule.ts`
- **出典に無い日は書かない**（予定であって実績ではない）。実際 9/19 は公式に日付タブ自体が無く、
  団体B〜D組の日程は不明なので書いていない

## 残作業

| # | 何を | なぜ |
|---|---|---|
| S5 | 前回大会（杭州2022）の結果を入れる | 「前回はほぼ全種目で金」は stakes の材料になる。**「過去の国際大会は遡らない」方針の、前回1件だけの例外**として検討 |
| S6 | `information` の未来レコードを補充（31件中9件しかない） | インターハイ・全中を含む主要大会の次回開催が未入力で「これから開催」に出ない |
| S7 | 未来大会の `venues` を補充（未来9件中2件しかない） | 開催前ブロックの会場欄が空になる |
| S8 | `world-championship` / `asian-championship` の本大会を登録 | 予選会だけある状態。登録すれば**命名規約により自動で相互リンク**される（コード変更不要） |

- 状態の確認は `npm run check:upcoming`（[1] 本大会の欠落 / [2] 未来レコード / [3] venues / [4] 代表名簿の氏名解決 / [5] 日程）。
- S6 の入れ方は `tournament-venue-data` スキルの手順。一次ソースは `t_records/{年度}/{年度}_taikai_alle.pdf`、
  作業用の断片は [venue-input-worksheet.md](../venue-input-worksheet.md)。
- **中止（`status: 'cancelled'`）の年は未来レコードとして数えない**。数えると次回の行を足し忘れても [2] に出なくなるため。

## やらないと決めたこと

| 項目 | 理由 |
|---|---|
| `isMajorTitle` の変更 | `resolveTier()` / 主要タイトル数 / **Elo の K値** / ニュースの注目選手ピック / 実績の並び順に効き、全選手のランキングが静かに動く。国際大会を「主要」扱いしたいなら**別フラグ**を立てる（ADR 相当の判断） |
| 過去の国際大会の全面的な遡り | S5（前回1件）だけを例外として検討する |
| 「これから開催」の独立ページ化 | まず既存面で効果を見る |
| 予選会2025を1カテゴリへ統合する | スキーマに「フェーズ」の概念が無く、統合すると `group` が衝突する。既存6ページの URL も消える |

**日本代表名簿を当サイトが名乗ること**は 2026-09-08 に解除した（S9）。当サイトのデータから代表を導出しない
方針は変えず、**JOC の発表の転記として**持ち込む形にした。出典・発表日をデータに必須で持たせ、描画側で必ず併記する。
名簿に無いこと（混合ダブルスのペア構成）は足さない。データの形は
[data-model.md](./data-model.md)「代表名簿（`delegations`）」、表示は [public-pages.md](./public-pages.md)。

## 実装済みのもの（要点だけ）

| # | 内容 |
|---|---|
| 第1弾 | アジア大会の登録・開催前ブロック・関連する大会・「これから開催」・`SportsEvent` JSON-LD・`check:upcoming`（2026-08-25） |
| M1 | 予選会2025の順位データ投入。規約「段階分割された大会では、**最終成績は決着したカテゴリだけが持つ**」（[data-model.md](./data-model.md)）に沿う。進出者の判定は順位ではなく**次のカテゴリの entries に居るか**で行う。検査 `npm run check:placements` |
| M2 | 進出率の分母から `placement: unknown` を除外（`lib/playerStats/aggregators/reachRates.ts`、`ENGINE_VERSION` 1.7.0）。**未開催の大会の出場者の進出率が不当に下がっていた**ため。仕様は元から正しく実装だけが漏れていた |
| S1 | 選手結果ページに「これから開催される国際大会」ブロック（`lib/upcomingInternational.ts` / `PlayerUpcomingInternational.tsx`）。**`/players/[id]` プロフィール側には未適用** |
| S2 | 大会ハブに予選会上位者を通算成績つきで表示（`lib/qualifierFinishers.ts`）→ S9 で代表名簿に差し替え |
| S3 | トップページに「これから開催」5件（共有コンポーネント `UpcomingTournaments.tsx`） |
| S4 | `/tournaments/major/` に開催前の大会を含める。**STリーグは結果があるのに一覧から抜けていた**のを解消 |
| S9 | 公式の代表名簿で S1・S2 を置き換え（`data/tournaments/delegations/asian-games-2026.json` / `lib/delegation.ts` / `DelegationSection.tsx`）。検査 `check:upcoming [4]` |
| S10 | 種目別の日程（上記）。検査 `check:upcoming [5]` |

テストは `npm run upcoming:test`（21件）。

## 関連

- [public-pages.md](./public-pages.md) — 「開催前の大会を出す」の仕様・表示条件
- [data-model.md](./data-model.md) — `venues` / `delegations` / `schedule` の形
- [seo.md](./seo.md) — 新規 URL を増やさず既存ページで受ける方針
- [ranking.md](./ranking.md) — 国際大会の除外
- [ADR-016](../adr/ADR-016-manual-adsense-units-over-auto-ads.md) — 広告枠と「これから開催」の上下関係
- [raw/2026-07-26](../raw/2026-07-26-idea-tournament-metadata-platform.md) — 経緯・実測データ（追記6〜12）
